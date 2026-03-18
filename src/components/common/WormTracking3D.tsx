import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useTranslation } from 'react-i18next';
import { clamp } from '../../engine/math';
import { WORLD_SIZE } from '../../engine/constants';
import type { SimConfig, SimEvent, Snapshot, World, WormState } from '../../engine/types';
import styles from './WormTracking3D.module.css';

const CAMERA_PRESETS = ['follow', 'side', 'top', 'overview'] as const;

type CameraPreset = (typeof CAMERA_PRESETS)[number];
type BoundarySide = 'north' | 'south' | 'east' | 'west';

interface WormTracking3DProps {
  worm: WormState;
  world: World;
  snapshot: Snapshot;
  config: SimConfig;
  eventMarkers?: SimEvent[];
  className?: string;
  defaultPreset?: CameraPreset;
  overlayTop?: string;
  showTemperatureField?: boolean;
  fallback?: ReactNode;
  showOverlayUi?: boolean;
}

interface BoundaryPlane {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  side: BoundarySide;
}

interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  floorMesh: THREE.Mesh;
  shadowFloorMesh: THREE.Mesh;
  floorMaterial: THREE.ShaderMaterial;
  foodMesh: THREE.Mesh;
  foodRing: THREE.LineLoop;
  obstacleGroup: THREE.Group;
  trailLine: THREE.Line;
  eventGroup: THREE.Group;
  impactRippleMesh: THREE.Mesh;
  wormMesh: THREE.Mesh;
  wormOutlineMesh: THREE.Mesh;
  wormMaterial: THREE.MeshToonMaterial;
  boundaryPlanes: Record<BoundarySide, BoundaryPlane>;
  followTarget: THREE.Vector3;
}

interface ImpactInfo {
  event: SimEvent;
  age: number;
  intensity: number;
  side: BoundarySide | null;
}

function worldToScene(x: number, y: number) {
  return new THREE.Vector3(x - WORLD_SIZE / 2, 0, y - WORLD_SIZE / 2);
}

function currentWormColor(state: WormState['state']) {
  if (state === 'reverse') return new THREE.Color('#f5c97b');
  if (state === 'turn') return new THREE.Color('#ffa0a0');
  return new THREE.Color('#7de2cf');
}

function headingForwardVector(heading: number) {
  return new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
}

function trackingRightVector(heading: number) {
  return new THREE.Vector3(-Math.sin(heading), 0, Math.cos(heading));
}

function createToonGradientMap() {
  const data = new Uint8Array([
    26, 26, 30, 255,
    92, 104, 120, 255,
    178, 194, 212, 255,
    245, 249, 255, 255,
  ]);
  const gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.colorSpace = THREE.SRGBColorSpace;
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

function buildBodyPose(worm: WormState, snapshot: Snapshot) {
  const segmentCount = worm.segments.length;
  const direction = worm.state === 'reverse' ? -1 : 1;
  const elapsed = snapshot.metrics.elapsed;
  const stateAmplitude = worm.state === 'turn' ? 0.86 : 0.56;
  const speedLift = clamp(snapshot.speed / 18, 0.4, 1.15);
  const headLift =
    worm.state === 'turn' ? 0.52 : worm.state === 'reverse' ? 0.34 : 0.22;

  return worm.segments.map((segment, index, segments) => {
    const prev = segments[Math.max(0, index - 1)];
    const next = segments[Math.min(segmentCount - 1, index + 1)];
    const prevScene = worldToScene(prev.x, prev.y);
    const nextScene = worldToScene(next.x, next.y);
    const tangent = nextScene.clone().sub(prevScene).setY(0);
    if (tangent.lengthSq() < 1e-6) {
      tangent.set(1, 0, 0);
    } else {
      tangent.normalize();
    }
    const lateral = tangent.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const progress = segmentCount <= 1 ? 0 : index / (segmentCount - 1);
    const amplitude = stateAmplitude * (1 - progress * 0.92) * speedLift;
    const wave = Math.sin(elapsed * 10 * direction - index * 0.68) * amplitude;
    const base = worldToScene(segment.x, segment.y);
    const arch = Math.sin(progress * Math.PI) * 0.16 * speedLift;
    const lift = Math.max(0, 1 - index / 4.2) * headLift * speedLift;

    return new THREE.Vector3(
      base.x + lateral.x * wave,
      0.06 + arch + lift,
      base.z + lateral.z * wave,
    );
  });
}

function buildSmoothWormGeometry(points: THREE.Vector3[], state: WormState['state']) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45);
  const tubularSegments = Math.max(42, points.length * 6);
  const radialSegments = 20;
  const sampledPoints = curve.getPoints(tubularSegments);
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const bodyColor = currentWormColor(state);
  const headColor = new THREE.Color('#f2f7ff');
  const headTangent = curve.getTangent(0).normalize();
  const tailTangent = curve.getTangent(1).normalize();
  const ringSize = radialSegments + 1;

  for (let ring = 0; ring <= tubularSegments; ring += 1) {
    const center = sampledPoints[ring];
    const normal = frames.normals[ring];
    const binormal = frames.binormals[ring];
    const t = tubularSegments === 0 ? 0 : ring / tubularSegments;
    const headTaper = THREE.MathUtils.lerp(0.68, 1, clamp(t / 0.18, 0, 1));
    const tailTaper = THREE.MathUtils.lerp(1, 0.26, Math.pow(clamp((t - 0.74) / 0.26, 0, 1), 1.2));
    const radius = THREE.MathUtils.lerp(1.02, 0.24, Math.pow(t, 0.78));
    const bulge = Math.max(0, 1 - t / 0.12) * 0.08;
    const ringRadius = (radius + bulge) * headTaper * tailTaper;
    const ringColor = headColor.clone().lerp(bodyColor, clamp(t / 0.16, 0, 1));

    for (let step = 0; step <= radialSegments; step += 1) {
      const angle = (step / radialSegments) * Math.PI * 2;
      const direction = normal
        .clone()
        .multiplyScalar(Math.cos(angle))
        .add(binormal.clone().multiplyScalar(Math.sin(angle)));
      const vertex = center.clone().add(direction.multiplyScalar(ringRadius));
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(ringColor.r, ringColor.g, ringColor.b);
      uvs.push(t, step / radialSegments);
    }
  }

  for (let ring = 0; ring < tubularSegments; ring += 1) {
    for (let step = 0; step < radialSegments; step += 1) {
      const a = ring * ringSize + step;
      const b = a + ringSize;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const headTip = sampledPoints[0].clone().addScaledVector(headTangent, -0.9);
  const tailTip = sampledPoints[tubularSegments].clone().addScaledVector(tailTangent, 0.36);
  const headTipIndex = positions.length / 3;
  positions.push(headTip.x, headTip.y, headTip.z);
  colors.push(headColor.r, headColor.g, headColor.b);
  uvs.push(0, 0.5);

  const tailTipIndex = positions.length / 3;
  positions.push(tailTip.x, tailTip.y, tailTip.z);
  colors.push(bodyColor.r, bodyColor.g, bodyColor.b);
  uvs.push(1, 0.5);

  const tailRingStart = tubularSegments * ringSize;
  for (let step = 0; step < radialSegments; step += 1) {
    const headA = step;
    const headB = step + 1;
    indices.push(headTipIndex, headB, headA);

    const tailA = tailRingStart + step;
    const tailB = tailA + 1;
    indices.push(tailTipIndex, tailA, tailB);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createOutlineGeometry(source: THREE.BufferGeometry, thickness: number) {
  const outlineGeometry = source.clone();
  const position = outlineGeometry.getAttribute('position');
  const normals = outlineGeometry.getAttribute('normal');
  if (!(position instanceof THREE.BufferAttribute) || !(normals instanceof THREE.BufferAttribute)) {
    return outlineGeometry;
  }

  for (let index = 0; index < position.count; index += 1) {
    position.setXYZ(
      index,
      position.getX(index) + normals.getX(index) * thickness,
      position.getY(index) + normals.getY(index) * thickness,
      position.getZ(index) + normals.getZ(index) * thickness,
    );
  }

  position.needsUpdate = true;
  outlineGeometry.computeBoundingSphere();
  return outlineGeometry;
}

const ARENA_FLOOR_VERTEX_SHADER = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const ARENA_FLOOR_FRAGMENT_SHADER = `
varying vec3 vWorldPosition;

uniform float uWorldSize;
uniform float uOverlayOpacity;
uniform float uChemicalVisible;
uniform float uFoodRadius;
uniform float uChemicalRadius;
uniform vec2 uFoodPos;
uniform float uTemperatureVisible;
uniform float uTemperatureMode;
uniform vec2 uHotspot;
uniform float uPreferredTemperature;

vec3 screenBlend(vec3 base, vec3 blend, float opacity) {
  vec3 screened = 1.0 - (1.0 - base) * (1.0 - blend);
  return mix(base, screened, clamp(opacity, 0.0, 1.0));
}

void main() {
  vec2 uv = vec2(
    (vWorldPosition.x + uWorldSize * 0.5) / uWorldSize,
    (vWorldPosition.z + uWorldSize * 0.5) / uWorldSize
  );
  uv = clamp(uv, 0.0, 1.0);

  vec3 color = mix(vec3(0.031, 0.047, 0.071), vec3(0.039, 0.055, 0.078), 1.0 - uv.y);

  float ambient = 1.0 - smoothstep(0.0, 0.72, distance(uv, vec2(0.76, 0.24)));
  color += vec3(0.18, 0.34, 0.30) * ambient * 0.12;

  float softField = clamp((1.0 - uv.x) * 0.64 + uv.y * 0.82, 0.0, 1.0);
  color = mix(color, color + vec3(0.03, 0.06, 0.06), softField * 0.18);

  if (uChemicalVisible > 0.0) {
    float chemicalDist = distance(uv, uFoodPos);
    float chemical = 1.0 - smoothstep(0.0, uChemicalRadius, chemicalDist);
    float chemicalCore = chemical * chemical;
    color = screenBlend(color, vec3(0.40, 0.82, 0.62), chemicalCore * (0.22 * uOverlayOpacity + 0.08));
    color = mix(color, color + vec3(0.06, 0.12, 0.09), chemical * 0.12 * uOverlayOpacity);
  }

  if (uTemperatureVisible > 0.0) {
    if (uTemperatureMode < 1.5) {
      vec3 linearField = mix(vec3(0.31, 0.47, 1.0), vec3(1.0, 0.69, 0.38), uv.x);
      color = screenBlend(color, linearField, (0.14 * uOverlayOpacity + 0.06) * uTemperatureVisible);

      float preferenceLine = (1.0 - smoothstep(0.0, 0.0035, abs(uv.x - uPreferredTemperature)))
        * step(0.45, fract(uv.y * 26.0));
      color = mix(color, vec3(0.84, 0.90, 1.0), preferenceLine * 0.32 * uTemperatureVisible);
    } else {
      float hotspotDist = distance(uv, uHotspot);
      float hotspot = 1.0 - smoothstep(0.0, 0.62, hotspotDist);
      float coolRing = smoothstep(0.16, 0.62, hotspotDist);
      color = screenBlend(color, vec3(1.0, 0.72, 0.42), hotspot * (0.13 * uOverlayOpacity + 0.05) * uTemperatureVisible);
      color = screenBlend(color, vec3(0.42, 0.52, 1.0), coolRing * (0.09 * uOverlayOpacity + 0.04) * uTemperatureVisible);
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

function createArenaFloorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWorldSize: { value: WORLD_SIZE },
      uOverlayOpacity: { value: 0.34 },
      uChemicalVisible: { value: 0 },
      uFoodRadius: { value: 0.14 },
      uChemicalRadius: { value: 0.24 },
      uFoodPos: { value: new THREE.Vector2(0.5, 0.5) },
      uTemperatureVisible: { value: 0 },
      uTemperatureMode: { value: 0 },
      uHotspot: { value: new THREE.Vector2(0.5, 0.5) },
      uPreferredTemperature: { value: 0.5 },
    },
    vertexShader: ARENA_FLOOR_VERTEX_SHADER,
    fragmentShader: ARENA_FLOOR_FRAGMENT_SHADER,
    depthWrite: true,
  });
}

function buildCirclePoints(radius: number, height = 0, segments = 72) {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius));
  }
  return points;
}

function createCircleLine(radius: number, color: string, opacity: number, height = 0.02, segments = 72) {
  const geometry = new THREE.BufferGeometry().setFromPoints(buildCirclePoints(radius, height, segments));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineLoop(geometry, material);
}

function disposeObject3D(target: THREE.Object3D) {
  target.traverse((object) => {
    const disposable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (disposable.geometry instanceof THREE.BufferGeometry) {
      disposable.geometry.dispose();
    }
    if (disposable.material) {
      const materials = Array.isArray(disposable.material)
        ? disposable.material
        : [disposable.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject3D(child);
  }
}

function updateArenaMaterial(
  material: THREE.ShaderMaterial,
  config: SimConfig,
  world: World,
  showTemperatureField: boolean,
) {
  const showTemperatureOverlay =
    (config.world.temperatureMode !== 'none' && config.visuals.showTemperatureOverlay) ||
    showTemperatureField;
  const temperatureMode =
    config.world.temperatureMode === 'linear'
      ? 1
      : config.world.temperatureMode === 'radial'
        ? 2
        : 0;

  material.uniforms.uOverlayOpacity.value = config.visuals.overlayOpacity;
  material.uniforms.uChemicalVisible.value = config.visuals.showChemicalOverlay ? 1 : 0;
  material.uniforms.uFoodRadius.value = world.food.radius / WORLD_SIZE;
  material.uniforms.uChemicalRadius.value = (world.food.radius * 4.6) / WORLD_SIZE;
  material.uniforms.uFoodPos.value.set(world.food.x / WORLD_SIZE, world.food.y / WORLD_SIZE);
  material.uniforms.uTemperatureVisible.value = showTemperatureOverlay ? 1 : 0;
  material.uniforms.uTemperatureMode.value = temperatureMode;
  material.uniforms.uHotspot.value.set(
    world.temperatureHotspot.x / WORLD_SIZE,
    world.temperatureHotspot.y / WORLD_SIZE,
  );
  material.uniforms.uPreferredTemperature.value = config.world.preferredTemperature;
}

function updateFoodDecor(context: SceneContext, world: World) {
  const foodPosition = worldToScene(world.food.x, world.food.y);
  context.foodMesh.position.set(foodPosition.x, 0.022, foodPosition.z);
  context.foodMesh.scale.setScalar(world.food.radius);
  context.foodRing.position.set(foodPosition.x, 0.028, foodPosition.z);
  context.foodRing.scale.setScalar(world.food.radius * 1.1);
}

function rebuildObstacleGroup(context: SceneContext, world: World) {
  clearGroup(context.obstacleGroup);

  world.obstacles.forEach((obstacle) => {
    const position = worldToScene(obstacle.x, obstacle.y);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(obstacle.r, 40),
      new THREE.MeshBasicMaterial({
        color: '#747e90',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(position.x, 0.018, position.z);

    const ring = createCircleLine(obstacle.r, '#a1adc1', 0.18, 0.024, 56);
    ring.position.set(position.x, 0, position.z);

    context.obstacleGroup.add(fill, ring);
  });
}

function updateTrailLine(context: SceneContext, worm: WormState) {
  const trailPoints =
    worm.trail.length > 1
      ? worm.trail.map((point) => {
          const scenePoint = worldToScene(point.x, point.y);
          return scenePoint.setY(0.036);
        })
      : [new THREE.Vector3(0, 0.036, 0)];

  const previousGeometry = context.trailLine.geometry;
  context.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
  previousGeometry.dispose();
  context.trailLine.visible = worm.trail.length > 1;
}

function eventMarkerColor(event: SimEvent, alpha: number) {
  void alpha;
  if (event.type === 'collision') return new THREE.Color('#ff8c8c');
  if (event.type === 'turn') return new THREE.Color('#ffcc74');
  return new THREE.Color('#7de2cf');
}

function rebuildEventMarkers(context: SceneContext, eventMarkers: SimEvent[]) {
  clearGroup(context.eventGroup);

  eventMarkers.slice(0, 20).forEach((event, index) => {
    const alpha = clamp(0.45 - index * 0.02, 0.1, 0.45);
    const position = worldToScene(event.x, event.y);
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.44, 24),
      new THREE.MeshBasicMaterial({
        color: eventMarkerColor(event, alpha),
        transparent: true,
        opacity: alpha,
        depthWrite: false,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(position.x, 0.042, position.z);
    context.eventGroup.add(marker);
  });
}

function updateImpactRipple(context: SceneContext, impact: ImpactInfo | null) {
  const rippleMaterial = context.impactRippleMesh.material as THREE.MeshBasicMaterial;
  if (!impact) {
    rippleMaterial.opacity = 0;
    context.impactRippleMesh.visible = false;
    return;
  }

  const position = worldToScene(impact.event.x, impact.event.y);
  const radius = 3 + (1 - impact.intensity) * 12;
  context.impactRippleMesh.visible = true;
  context.impactRippleMesh.position.set(position.x, 0.045, position.z);
  context.impactRippleMesh.scale.set(radius, radius, 1);
  rippleMaterial.opacity = 0.14 + impact.intensity * 0.2;
}

function focusTarget(points: THREE.Vector3[], heading: number) {
  const head = points[0] ?? new THREE.Vector3();
  const forward = headingForwardVector(heading);
  return head.clone().addScaledVector(forward, 2.6).setY(head.y + 0.2);
}

function presetCameraState(preset: CameraPreset, target: THREE.Vector3, heading: number) {
  const forward = headingForwardVector(heading);
  const right = trackingRightVector(heading);
  const configByPreset: Record<
    CameraPreset,
    { forwardOffset: number; rightOffset: number; height: number; lookAhead: number; fov: number }
  > = {
    follow: { forwardOffset: -11.5, rightOffset: 1.2, height: 5.4, lookAhead: 5.8, fov: 52 },
    side: { forwardOffset: -1.8, rightOffset: 13.8, height: 4.8, lookAhead: 1.2, fov: 48 },
    top: { forwardOffset: 0, rightOffset: 0, height: 26, lookAhead: 0, fov: 36 },
    overview: { forwardOffset: 14, rightOffset: 16.5, height: 15.8, lookAhead: 0, fov: 44 },
  };

  const presetConfig = configByPreset[preset];
  const position = target
    .clone()
    .addScaledVector(forward, presetConfig.forwardOffset)
    .addScaledVector(right, presetConfig.rightOffset)
    .add(new THREE.Vector3(0, presetConfig.height, 0));
  const lookAt = target.clone().addScaledVector(forward, presetConfig.lookAhead);
  const up = preset === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);

  return {
    position,
    lookAt,
    fov: presetConfig.fov,
    up,
  };
}

function findImpact(snapshot: Snapshot) {
  const collision = snapshot.events.find((event) => event.type === 'collision');
  if (!collision) return null;

  const age = snapshot.metrics.elapsed - collision.time;
  if (age < 0 || age > 0.72) return null;

  const distances: Record<BoundarySide, number> = {
    west: collision.x,
    east: WORLD_SIZE - collision.x,
    north: collision.y,
    south: WORLD_SIZE - collision.y,
  };

  const ordered = Object.entries(distances).sort((a, b) => a[1] - b[1]) as Array<
    [BoundarySide, number]
  >;
  const [side, nearestDistance] = ordered[0];

  return {
    event: collision,
    age,
    intensity: clamp(1 - age / 0.72, 0, 1),
    side: nearestDistance <= 3 ? side : null,
  } satisfies ImpactInfo;
}

function updateBoundaryPlanes(context: SceneContext, impact: ImpactInfo | null) {
  (Object.keys(context.boundaryPlanes) as BoundarySide[]).forEach((side) => {
    const entry = context.boundaryPlanes[side];
    entry.material.opacity = 0;
    entry.mesh.scale.set(1, 1, 1);
  });

  if (!impact?.side) return;

  const entry = context.boundaryPlanes[impact.side];
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.04);
  entry.material.opacity = 0.06 + impact.intensity * 0.12 * pulse;
  if (impact.side === 'north' || impact.side === 'south') {
    entry.mesh.scale.set(1 + impact.intensity * 0.04, 1 + impact.intensity * 0.18, 1);
  } else {
    entry.mesh.scale.set(1, 1 + impact.intensity * 0.18, 1 + impact.intensity * 0.04);
  }
}

function disposeScene(scene: THREE.Scene, extraTextures: THREE.Texture[] = []) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>(extraTextures);
  type DisposableObject = THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
  };

  scene.traverse((object) => {
    const target = object as DisposableObject;
    if (target.geometry instanceof THREE.BufferGeometry) {
      geometries.add(target.geometry);
    }
    if (target.material) {
      const materialList = Array.isArray(target.material) ? target.material : [target.material];
      materialList.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) {
            textures.add(value);
          }
        });
      });
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function createBoundaryPlane(side: BoundarySide) {
  const material = new THREE.MeshBasicMaterial({
    color: '#f5c97b',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  let mesh: THREE.Mesh;

  if (side === 'north' || side === 'south') {
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, 5), material);
    mesh.position.set(0, 2.5, side === 'north' ? -WORLD_SIZE / 2 : WORLD_SIZE / 2);
  } else {
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, 5), material);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(side === 'east' ? WORLD_SIZE / 2 : -WORLD_SIZE / 2, 2.5, 0);
  }

  return { mesh, material, side };
}

function createScene(container: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#000000', 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#080c12', 26, 120);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 280);
  camera.position.set(0, 16, 22);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 92;
  controls.maxPolarAngle = Math.PI / 2.03;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.enabled = false;

  scene.add(new THREE.HemisphereLight('#d9f4ff', '#14202a', 1.12));

  const keyLight = new THREE.DirectionalLight('#f6f3e6', 1.36);
  keyLight.position.set(22, 28, 14);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -70;
  keyLight.shadow.camera.right = 70;
  keyLight.shadow.camera.top = 70;
  keyLight.shadow.camera.bottom = -70;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 110;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#76b5ff', 0.48);
  fillLight.position.set(-24, 18, -20);
  scene.add(fillLight);

  const toonGradientMap = createToonGradientMap();
  const floorMaterial = createArenaFloorMaterial();

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    floorMaterial,
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = false;
  scene.add(floorMesh);

  const shadowFloorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.ShadowMaterial({
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  shadowFloorMesh.rotation.x = -Math.PI / 2;
  shadowFloorMesh.position.y = 0.01;
  shadowFloorMesh.receiveShadow = true;
  scene.add(shadowFloorMesh);

  const foodMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 80),
    new THREE.MeshBasicMaterial({
      color: '#5fc492',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  foodMesh.rotation.x = -Math.PI / 2;
  scene.add(foodMesh);

  const foodRing = createCircleLine(1, '#92f3b9', 0.36, 0, 96);
  scene.add(foodRing);

  const obstacleGroup = new THREE.Group();
  scene.add(obstacleGroup);

  const trailLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: '#82cdbe',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  trailLine.visible = false;
  scene.add(trailLine);

  const eventGroup = new THREE.Group();
  scene.add(eventGroup);

  const impactRippleMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1.16, 72),
    new THREE.MeshBasicMaterial({
      color: '#f5c97b',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  impactRippleMesh.rotation.x = -Math.PI / 2;
  impactRippleMesh.visible = false;
  scene.add(impactRippleMesh);

  const wormMaterial = new THREE.MeshToonMaterial({
    vertexColors: true,
    color: '#ffffff',
    gradientMap: toonGradientMap,
    transparent: true,
    opacity: 0.99,
  });
  const wormMesh = new THREE.Mesh(new THREE.BufferGeometry(), wormMaterial);
  wormMesh.castShadow = true;
  wormMesh.receiveShadow = false;
  wormMesh.renderOrder = 3;
  scene.add(wormMesh);

  const wormOutlineMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: '#173238',
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );
  wormOutlineMesh.renderOrder = 2;
  scene.add(wormOutlineMesh);

  const north = createBoundaryPlane('north');
  const south = createBoundaryPlane('south');
  const east = createBoundaryPlane('east');
  const west = createBoundaryPlane('west');
  scene.add(north.mesh, south.mesh, east.mesh, west.mesh);

  return {
    scene,
    camera,
    renderer,
    controls,
    floorMesh,
    shadowFloorMesh,
    floorMaterial,
    foodMesh,
    foodRing,
    obstacleGroup,
    trailLine,
    eventGroup,
    impactRippleMesh,
    wormMesh,
    wormOutlineMesh,
    wormMaterial,
    boundaryPlanes: { north, south, east, west },
    followTarget: new THREE.Vector3(),
  } satisfies SceneContext;
}

export function WormTracking3D({
  worm,
  world,
  snapshot,
  config,
  eventMarkers = snapshot.events,
  className,
  defaultPreset = 'follow',
  overlayTop = '12px',
  showTemperatureField = false,
  fallback = null,
  showOverlayUi = true,
}: WormTracking3DProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<SceneContext | null>(null);
  const [preset, setPreset] = useState<CameraPreset>(defaultPreset);
  const [freeOrbit, setFreeOrbit] = useState(false);
  const [failed, setFailed] = useState(false);

  const presetLabels = useMemo(
    () =>
      CAMERA_PRESETS.map((item) => ({
        value: item,
        label: t(`tracking3d.presets.${item}`),
      })),
    [t],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || failed) return undefined;

    let context: SceneContext;
    try {
      context = createScene(container);
    } catch (error) {
      console.error('Failed to initialize 3D tracking view.', error);
      setFailed(true);
      return undefined;
    }

    contextRef.current = context;

    const renderNow = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      context.camera.aspect = width / height;
      context.camera.updateProjectionMatrix();
      context.renderer.setSize(width, height, false);
      context.renderer.render(context.scene, context.camera);
    };

    let cleanupResize = () => {};

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(renderNow);
      resizeObserver.observe(container);
      cleanupResize = () => resizeObserver.disconnect();
    } else {
      const onResize = () => renderNow();
      window.addEventListener('resize', onResize);
      cleanupResize = () => window.removeEventListener('resize', onResize);
    }

    context.controls.addEventListener('change', renderNow);
    renderNow();

    return () => {
      context.controls.removeEventListener('change', renderNow);
      cleanupResize();
      context.controls.dispose();
      context.renderer.dispose();
      disposeScene(context.scene);
      if (context.renderer.domElement.parentNode === container) {
        container.removeChild(context.renderer.domElement);
      }
      contextRef.current = null;
    };
  }, [failed]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    context.controls.enabled = freeOrbit;
  }, [freeOrbit]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;

    updateArenaMaterial(context.floorMaterial, config, world, showTemperatureField);
    updateFoodDecor(context, world);
    rebuildObstacleGroup(context, world);
  }, [world, config, showTemperatureField]);

  useEffect(() => {
    const context = contextRef.current;
    const container = containerRef.current;
    if (!context || !container || worm.segments.length < 2) return;

    const impact = findImpact(snapshot);
    if (config.visuals.showTrail) {
      updateTrailLine(context, worm);
    } else {
      context.trailLine.visible = false;
    }

    if (config.visuals.showEventMarkers) {
      rebuildEventMarkers(context, eventMarkers);
    } else {
      clearGroup(context.eventGroup);
    }

    updateImpactRipple(context, impact);
    updateBoundaryPlanes(context, impact);

    const bodyPoints = buildBodyPose(worm, snapshot);
    const nextGeometry = buildSmoothWormGeometry(bodyPoints, worm.state);
    const nextOutlineGeometry = createOutlineGeometry(nextGeometry, 0.06);

    const previousGeometry = context.wormMesh.geometry;
    const previousOutlineGeometry = context.wormOutlineMesh.geometry;
    context.wormMesh.geometry = nextGeometry;
    context.wormOutlineMesh.geometry = nextOutlineGeometry;
    previousGeometry.dispose();
    previousOutlineGeometry.dispose();

    const focus = focusTarget(bodyPoints, snapshot.heading);

    if (freeOrbit) {
      if (context.followTarget.lengthSq() === 0) {
        context.followTarget.copy(focus);
      }
      const delta = focus.clone().sub(context.followTarget);
      context.controls.target.add(delta);
      context.camera.position.add(delta);
      context.followTarget.copy(focus);
      context.controls.update();
    } else {
      const cameraState = presetCameraState(preset, focus, snapshot.heading);
      context.followTarget.copy(focus);
      context.camera.fov = THREE.MathUtils.lerp(context.camera.fov, cameraState.fov, 0.22);
      context.camera.position.lerp(cameraState.position, 0.2);
      context.camera.up.lerp(cameraState.up, 0.24).normalize();
      context.controls.target.lerp(cameraState.lookAt, 0.24);
      context.camera.lookAt(context.controls.target);
      context.camera.updateProjectionMatrix();
    }

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    context.camera.aspect = width / height;
    context.camera.updateProjectionMatrix();
    context.renderer.setSize(width, height, false);
    context.renderer.render(context.scene, context.camera);
  }, [worm, snapshot, eventMarkers, config, preset, freeOrbit]);

  if (failed) {
    return <>{fallback}</>;
  }

  const viewerStyle = {
    ['--overlay-top' as string]: overlayTop,
  } as CSSProperties;

  return (
    <div className={[styles.viewer, className ?? ''].filter(Boolean).join(' ')} style={viewerStyle}>
      <div ref={containerRef} className={styles.viewport} />

      {showOverlayUi ? (
        <div className={styles.toolbar}>
          <div className={`${styles.group} ${styles.groupPrimary}`}>
            {presetLabels.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${styles.chip} ${preset === item.value ? styles.chipActive : ''}`}
                onClick={() => {
                  setPreset(item.value);
                  setFreeOrbit(false);
                }}
                aria-pressed={preset === item.value && !freeOrbit}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={`${styles.group} ${styles.groupUtility}`}>
            <button
              type="button"
              className={`${styles.chip} ${freeOrbit ? styles.chipActive : styles.chipGhost}`}
              onClick={() => setFreeOrbit((current) => !current)}
              aria-pressed={freeOrbit}
            >
              {t('tracking3d.freeOrbit')}
            </button>
            <button
              type="button"
              className={`${styles.chip} ${styles.chipGhost}`}
              onClick={() => setFreeOrbit(false)}
            >
              {t('tracking3d.resetView')}
            </button>
          </div>
        </div>
      ) : null}

      {showOverlayUi ? (
        <div className={styles.footer}>
          <div className={styles.hint}>{t('tracking3d.controlsHint')}</div>
        </div>
      ) : null}
    </div>
  );
}
