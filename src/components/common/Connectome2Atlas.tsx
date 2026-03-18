import { useRef, useState } from 'react';

import {
  buildConnectome2Frame,
  connectome2ActivityColor,
  connectome2LayoutNodes,
  connectome2RoleColor,
  type Connectome2Pathway,
} from '../../engine/connectome2';

const VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 580;
const PADDING_X = 72;
const PADDING_Y = 78;
const BODY_WIDTH = VIEWBOX_WIDTH - PADDING_X * 2;
const BODY_HEIGHT = VIEWBOX_HEIGHT - PADDING_Y * 2;

const CONNECTOME2_BY_NAME = new Map(connectome2LayoutNodes.map((node) => [node.name, node]));

interface Connectome2AtlasClassNames {
  svg: string;
  node: string;
  nodeLabel: string;
  axisLabel: string;
  footLabel: string;
}

interface Connectome2AtlasProps {
  frame: ReturnType<typeof buildConnectome2Frame>;
  selectedNeuron: string;
  setSelectedNeuron: (name: string) => void;
  classNames: Connectome2AtlasClassNames;
  highlightedLabelLimit?: number;
  ariaLabel?: string;
  wrapperClassName?: string;
  enablePan?: boolean;
}

interface AtlasViewState {
  x: number;
  y: number;
  zoom: number;
}

interface PointerSample {
  clientX: number;
  clientY: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.8;

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampedViewState(viewState: AtlasViewState) {
  const viewWidth = VIEWBOX_WIDTH / viewState.zoom;
  const viewHeight = VIEWBOX_HEIGHT / viewState.zoom;

  return {
    ...viewState,
    x: clampValue(viewState.x, 0, VIEWBOX_WIDTH - viewWidth),
    y: clampValue(viewState.y, 0, VIEWBOX_HEIGHT - viewHeight),
  };
}

function pointerDistance(points: PointerSample[]) {
  const [first, second] = points;
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function pointerCenter(points: PointerSample[]) {
  const [first, second] = points;
  if (!first || !second) {
    return { clientX: 0, clientY: 0 };
  }
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
}

function zoomViewStateAtPoint(
  viewState: AtlasViewState,
  rect: DOMRect,
  clientX: number,
  clientY: number,
  nextZoom: number,
) {
  const zoom = clampValue(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const ratioX = clampValue((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  const ratioY = clampValue((clientY - rect.top) / Math.max(1, rect.height), 0, 1);
  const currentViewWidth = VIEWBOX_WIDTH / viewState.zoom;
  const currentViewHeight = VIEWBOX_HEIGHT / viewState.zoom;
  const focusX = viewState.x + ratioX * currentViewWidth;
  const focusY = viewState.y + ratioY * currentViewHeight;
  const nextViewWidth = VIEWBOX_WIDTH / zoom;
  const nextViewHeight = VIEWBOX_HEIGHT / zoom;

  return clampedViewState({
    x: focusX - ratioX * nextViewWidth,
    y: focusY - ratioY * nextViewHeight,
    zoom,
  });
}

function nodePoint(name: string) {
  const entry = CONNECTOME2_BY_NAME.get(name);
  if (!entry) return null;

  return {
    x: PADDING_X + entry.xNorm * BODY_WIDTH,
    y: PADDING_Y + (1 - entry.zNorm) * BODY_HEIGHT,
  };
}

function pathwayStroke(pathway: Connectome2Pathway) {
  if (pathway.edgeType === 'electrical') {
    return pathway.flux >= 0 ? 'rgba(135, 167, 255, 0.44)' : 'rgba(111, 200, 255, 0.42)';
  }
  return pathway.flux >= 0 ? 'rgba(255, 138, 138, 0.58)' : 'rgba(111, 200, 255, 0.56)';
}

function pathwayWidth(pathway: Connectome2Pathway) {
  return 1 + Math.min(4, Math.abs(pathway.flux) * (pathway.edgeType === 'effective' ? 6.4 : 4.4));
}

export function Connectome2Atlas({
  frame,
  selectedNeuron,
  setSelectedNeuron,
  classNames,
  highlightedLabelLimit,
  ariaLabel = 'C. elegans neural atlas',
  wrapperClassName,
  enablePan = false,
}: Connectome2AtlasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{
    pointerX: number;
    pointerY: number;
    viewX: number;
    viewY: number;
  } | null>(null);
  const pointerMapRef = useRef<Map<number, PointerSample>>(new Map());
  const pinchOriginRef = useRef<{
    distance: number;
    viewState: AtlasViewState;
  } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [viewState, setViewState] = useState<AtlasViewState>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const highlightedNames =
    typeof highlightedLabelLimit === 'number'
      ? frame.highlightedNames.slice(0, highlightedLabelLimit)
      : frame.highlightedNames;
  const canPan = enablePan && viewState.zoom > 1.001;
  const viewWidth = VIEWBOX_WIDTH / viewState.zoom;
  const viewHeight = VIEWBOX_HEIGHT / viewState.zoom;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerMapRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    const activePointers = [...pointerMapRef.current.values()];
    if (enablePan && activePointers.length === 2) {
      pinchOriginRef.current = {
        distance: Math.max(1, pointerDistance(activePointers)),
        viewState,
      };
      dragOriginRef.current = null;
      setDragging(false);
      return;
    }

    if (!canPan || event.button !== 0) return;

    dragOriginRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewX: viewState.x,
      viewY: viewState.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerMapRef.current.has(event.pointerId)) {
      pointerMapRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    const viewport = viewportRef.current;
    const activePointers = [...pointerMapRef.current.values()];
    if (enablePan && viewport && pinchOriginRef.current && activePointers.length >= 2) {
      const rect = viewport.getBoundingClientRect();
      const center = pointerCenter(activePointers);
      const nextZoom =
        pinchOriginRef.current.viewState.zoom *
        (pointerDistance(activePointers) / pinchOriginRef.current.distance);

      suppressClickUntilRef.current = performance.now() + 160;
      setViewState(
        zoomViewStateAtPoint(
          pinchOriginRef.current.viewState,
          rect,
          center.clientX,
          center.clientY,
          nextZoom,
        ),
      );
      return;
    }

    const dragOrigin = dragOriginRef.current;
    if (!viewport || !dragOrigin || !canPan) return;

    const dx = event.clientX - dragOrigin.pointerX;
    const dy = event.clientY - dragOrigin.pointerY;
    const scaleX = viewWidth / Math.max(1, viewport.clientWidth);
    const scaleY = viewHeight / Math.max(1, viewport.clientHeight);

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      suppressClickUntilRef.current = performance.now() + 160;
    }

    setViewState((current) =>
      clampedViewState({
        ...current,
        x: dragOrigin.viewX - dx * scaleX,
        y: dragOrigin.viewY - dy * scaleY,
      }),
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerMapRef.current.delete(event.pointerId);
    if (pointerMapRef.current.size < 2) {
      pinchOriginRef.current = null;
    }
    dragOriginRef.current = null;
    setDragging(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!enablePan) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    suppressClickUntilRef.current = performance.now() + 120;
    setViewState((current) =>
      zoomViewStateAtPoint(current, rect, event.clientX, event.clientY, current.zoom * zoomFactor),
    );
  };

  const handleNodeClick = (name: string) => {
    if (suppressClickUntilRef.current > performance.now()) return;
    setSelectedNeuron(name);
  };

  return (
    <div
      ref={viewportRef}
      className={wrapperClassName}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{
        cursor: canPan ? (dragging ? 'grabbing' : 'grab') : 'default',
        touchAction: enablePan ? 'none' : 'auto',
      }}
    >
      <svg
        viewBox={`${viewState.x} ${viewState.y} ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className={classNames.svg}
        role="img"
        aria-label={ariaLabel}
      >
        <rect
          x="38"
          y="28"
          width="172"
          height="524"
          rx="24"
          fill="rgba(125, 226, 207, 0.04)"
          stroke="rgba(125, 226, 207, 0.1)"
        />
        <rect
          x="210"
          y="28"
          width="572"
          height="524"
          rx="24"
          fill="rgba(156, 184, 255, 0.03)"
          stroke="rgba(156, 184, 255, 0.08)"
        />
        <rect
          x="782"
          y="28"
          width="160"
          height="524"
          rx="24"
          fill="rgba(245, 201, 123, 0.04)"
          stroke="rgba(245, 201, 123, 0.1)"
        />

        {frame.pathways.map((pathway) => {
          const from = nodePoint(pathway.source);
          const to = nodePoint(pathway.target);
          if (!from || !to) return null;

          const midX = (from.x + to.x) / 2;
          const curve = Math.min(26, Math.abs(to.x - from.x) * 0.08 + Math.abs(to.y - from.y) * 0.02);
          const midY = (from.y + to.y) / 2 - curve;

          return (
            <path
              key={pathway.id}
              d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
              stroke={pathwayStroke(pathway)}
              strokeWidth={pathwayWidth(pathway)}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={pathway.edgeType === 'electrical' ? '5 5' : undefined}
              opacity={pathway.edgeType === 'effective' ? 0.92 : 0.72}
            />
          );
        })}

        {connectome2LayoutNodes.map((node) => {
          const point = nodePoint(node.name);
          if (!point) return null;

          const signedActivity = frame.activities[node.name] ?? 0;
          const effectiveInput = frame.effectiveInputs[node.name] ?? 0;
          const isHighlighted =
            frame.highlightedNames.includes(node.name) || node.name === selectedNeuron;
          const radius = 2.8 + Math.abs(signedActivity) * 6.4 + (isHighlighted ? 1.2 : 0);

          return (
            <circle
              key={node.name}
              cx={point.x}
              cy={point.y}
              r={radius}
              fill={connectome2ActivityColor(signedActivity)}
              stroke={isHighlighted ? 'rgba(255,255,255,0.92)' : connectome2RoleColor(node.role)}
              strokeWidth={isHighlighted ? 1.5 : 1.05}
              opacity={0.86 + Math.min(0.14, Math.abs(effectiveInput) * 0.2)}
              className={classNames.node}
              onClick={() => handleNodeClick(node.name)}
            />
          );
        })}

        {highlightedNames.map((name) => {
          const point = nodePoint(name);
          if (!point) return null;

          const anchor = point.x > VIEWBOX_WIDTH - 170 ? 'end' : 'start';
          const dx = anchor === 'end' ? -10 : 10;
          return (
            <text
              key={`label-${name}`}
              x={point.x + dx}
              y={point.y - 8}
              textAnchor={anchor}
              className={classNames.nodeLabel}
            >
              {name}
            </text>
          );
        })}

        <g>
          <text x="124" y="16" textAnchor="middle" className={classNames.axisLabel}>
            Head ensemble
          </text>
          <text x="496" y="16" textAnchor="middle" className={classNames.axisLabel}>
            Midbody relay
          </text>
          <text x="862" y="16" textAnchor="middle" className={classNames.axisLabel}>
            Tail ensemble
          </text>
          <text x="60" y="566" className={classNames.footLabel}>
            Head
          </text>
          <text x="922" y="566" textAnchor="end" className={classNames.footLabel}>
            Tail
          </text>
        </g>
      </svg>
    </div>
  );
}
