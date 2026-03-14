(() => {
  const STORAGE_KEYS = {
    saves: 'nema-lab-saves-v3',
    settings: 'nema-lab-settings-v3',
    lastLab: 'nema-lab-last-lab-v3'
  };

  const DEFAULT_CONFIG = {
    presetName: 'Food Seeking',
    worm: {
      baseSpeed: 15,
      turnSharpness: 1.6,
      reversalDuration: 720,
      segmentCount: 18
    },
    sensors: {
      touch: true,
      chemo: true,
      thermo: false,
      sampleDistance: 6,
      memory: 950,
      noise: 0.08
    },
    behavior: {
      turnProbability: 0.055,
      gradientGain: 1.2,
      exploration: 0.18,
      discomfort: 0.35
    },
    world: {
      obstacleDensity: 0.08,
      foodStrength: 1.1,
      foodRadius: 14,
      temperatureMode: 'none',
      preferredTemperature: 0.5
    },
    visuals: {
      showTrail: true,
      showChemicalOverlay: true,
      showTemperatureOverlay: false,
      showSensors: false,
      showEventMarkers: true,
      cleanMode: false,
      trailLength: 260,
      overlayOpacity: 0.34
    }
  };

  const PRESETS = [
    {
      id: 'food-seeking',
      name: 'Food Seeking',
      description: '화학 감각을 켠 기본 preset입니다. 국소 감각만으로도 먹이 방향으로 편향되는 경향을 보여줍니다.',
      tags: ['입문', '화학', '기본값'],
      overrides: {}
    },
    {
      id: 'touch-only',
      name: 'Touch Only',
      description: '촉각만 켠 상태입니다. 장애물 회피는 가능하지만 먹이를 안정적으로 찾기 어렵습니다.',
      tags: ['촉각', '비교용'],
      overrides: {
        presetName: 'Touch Only',
        sensors: { touch: true, chemo: false, thermo: false },
        world: { obstacleDensity: 0.12 },
        visuals: { showChemicalOverlay: false, showTemperatureOverlay: false }
      }
    },
    {
      id: 'chemo-bias',
      name: 'Chemo Bias',
      description: '화학 감각과 gradient gain을 높여, 먹이 패치로 더 빠르게 끌리는 조건입니다.',
      tags: ['화학', '탐색'],
      overrides: {
        presetName: 'Chemo Bias',
        behavior: { gradientGain: 2.1, exploration: 0.1 },
        sensors: { chemo: true, touch: true, thermo: false },
        visuals: { showChemicalOverlay: true }
      }
    },
    {
      id: 'thermal-belt',
      name: 'Thermal Belt',
      description: '온도 기울기와 선호 온도를 함께 사용합니다. 특정 온도 띠를 따라 머무르는 행동을 볼 수 있습니다.',
      tags: ['온도', '온도선호'],
      overrides: {
        presetName: 'Thermal Belt',
        sensors: { thermo: true, chemo: false, touch: true },
        world: { temperatureMode: 'linear', preferredTemperature: 0.62, obstacleDensity: 0.05 },
        visuals: { showChemicalOverlay: false, showTemperatureOverlay: true }
      }
    },
    {
      id: 'blind-rover',
      name: 'Blind Rover',
      description: '감각을 모두 끄고 exploration만으로 움직입니다. 단순 이동이 얼마나 비효율적인지 비교할 수 있습니다.',
      tags: ['무감각', '대조군'],
      overrides: {
        presetName: 'Blind Rover',
        sensors: { touch: false, chemo: false, thermo: false },
        behavior: { gradientGain: 0, exploration: 0.42, turnProbability: 0.08 },
        visuals: { showChemicalOverlay: false, showTemperatureOverlay: false }
      }
    },
    {
      id: 'obstacle-field',
      name: 'Obstacle Field',
      description: '장애물 밀도를 높여 촉각 기반 회피와 회전 이벤트를 집중적으로 관찰할 수 있습니다.',
      tags: ['촉각', '고밀도'],
      overrides: {
        presetName: 'Obstacle Field',
        sensors: { touch: true, chemo: true, thermo: false },
        world: { obstacleDensity: 0.18, foodRadius: 12 },
        behavior: { exploration: 0.22 }
      }
    }
  ];

  const LEGEND_ITEMS = [
    { label: 'Cruise', color: '#7de2cf' },
    { label: 'Reverse', color: '#f5c97b' },
    { label: 'Turn', color: '#ff9a9a' },
    { label: 'Food field', color: '#8be9b4' },
    { label: 'Obstacle', color: '#7b879b' },
    { label: 'Temperature field', color: '#9cb8ff' }
  ];

  const LAB_BINDINGS = [
    { id: 'wormBaseSpeed', path: 'worm.baseSpeed', label: 'Base speed', format: (v) => `${Number(v).toFixed(1)} u/s` },
    { id: 'wormTurnSharpness', path: 'worm.turnSharpness', label: 'Turn sharpness', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'wormReversalDuration', path: 'worm.reversalDuration', label: 'Reversal duration', format: (v) => `${Math.round(Number(v))} ms` },
    { id: 'wormSegmentCount', path: 'worm.segmentCount', label: 'Segment count', format: (v) => `${Math.round(Number(v))}` },
    { id: 'sensorTouch', path: 'sensors.touch', label: '촉각', type: 'checkbox' },
    { id: 'sensorChemo', path: 'sensors.chemo', label: '화학 감각', type: 'checkbox' },
    { id: 'sensorThermo', path: 'sensors.thermo', label: '온도 감각', type: 'checkbox' },
    { id: 'sensorSampleDistance', path: 'sensors.sampleDistance', label: 'Sample distance', format: (v) => `${Number(v).toFixed(1)}` },
    { id: 'sensorMemory', path: 'sensors.memory', label: 'Memory window', format: (v) => `${Math.round(Number(v))} ms` },
    { id: 'sensorNoise', path: 'sensors.noise', label: 'Sensor noise', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'behaviorTurnProbability', path: 'behavior.turnProbability', label: 'Base turn probability', format: (v) => `${(Number(v) * 100).toFixed(1)}%` },
    { id: 'behaviorGradientGain', path: 'behavior.gradientGain', label: 'Gradient follow gain', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'behaviorExploration', path: 'behavior.exploration', label: 'Exploration', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'behaviorDiscomfort', path: 'behavior.discomfort', label: 'Discomfort threshold', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'worldObstacleDensity', path: 'world.obstacleDensity', label: 'Obstacle density', format: (v) => `${(Number(v) * 100).toFixed(0)}%` },
    { id: 'worldFoodStrength', path: 'world.foodStrength', label: 'Food strength', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'worldFoodRadius', path: 'world.foodRadius', label: 'Food radius', format: (v) => `${Number(v).toFixed(1)}` },
    { id: 'worldTemperatureMode', path: 'world.temperatureMode', label: 'Temperature mode', type: 'select' },
    { id: 'worldPreferredTemperature', path: 'world.preferredTemperature', label: 'Preferred temperature', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'visualShowTrail', path: 'visuals.showTrail', label: 'Trail', type: 'checkbox', liveApply: true },
    { id: 'visualShowChemicalOverlay', path: 'visuals.showChemicalOverlay', label: 'Chemical overlay', type: 'checkbox', liveApply: true },
    { id: 'visualShowTemperatureOverlay', path: 'visuals.showTemperatureOverlay', label: 'Temperature overlay', type: 'checkbox', liveApply: true },
    { id: 'visualShowSensors', path: 'visuals.showSensors', label: 'Sensor points', type: 'checkbox', liveApply: true },
    { id: 'visualShowEventMarkers', path: 'visuals.showEventMarkers', label: 'Event markers', type: 'checkbox', liveApply: true },
    { id: 'visualCleanMode', path: 'visuals.cleanMode', label: 'Clean mode', type: 'checkbox', liveApply: true },
    { id: 'visualTrailLength', path: 'visuals.trailLength', label: 'Trail length', format: (v) => `${Math.round(Number(v))}`, liveApply: true },
    { id: 'visualOverlayOpacity', path: 'visuals.overlayOpacity', label: 'Overlay opacity', format: (v) => `${Math.round(Number(v) * 100)}%`, liveApply: true }
  ];

  const COMPARE_BINDINGS = [
    { id: 'compareSensorChemo', path: 'sensors.chemo', label: '화학 감각', type: 'checkbox' },
    { id: 'compareSensorThermo', path: 'sensors.thermo', label: '온도 감각', type: 'checkbox' },
    { id: 'compareGradientGain', path: 'behavior.gradientGain', label: 'Gradient gain', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'compareExploration', path: 'behavior.exploration', label: 'Exploration', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'compareObstacleDensity', path: 'world.obstacleDensity', label: 'Obstacle density', format: (v) => `${(Number(v) * 100).toFixed(0)}%` },
    { id: 'comparePreferredTemperature', path: 'world.preferredTemperature', label: 'Preferred temperature', format: (v) => `${Number(v).toFixed(2)}` },
    { id: 'compareTurnSharpness', path: 'worm.turnSharpness', label: 'Turn sharpness', format: (v) => `${Number(v).toFixed(2)}` }
  ];

  const LAB_SECTION_RULES = {
    sensors: (path) => path.startsWith('sensors.'),
    worm: (path) => path.startsWith('worm.'),
    behavior: (path) => path.startsWith('behavior.'),
    environment: (path) => path.startsWith('world.'),
    visuals: (path) => path.startsWith('visuals.'),
    seed: (path) => path === 'seed'
  };

  const SECTION_LABELS = {
    sensors: 'Sensors',
    worm: 'Worm',
    behavior: 'Behavior',
    environment: 'Environment',
    seed: 'Seed'
  };

  const $ = (id) => document.getElementById(id);

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, override) {
    const output = deepClone(base);
    const walk = (target, source) => {
      Object.keys(source || {}).forEach((key) => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          walk(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    };
    walk(output, override || {});
    return output;
  }

  function getByPath(object, path) {
    return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), object);
  }

  function setByPath(object, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    let cursor = object;
    parts.forEach((part) => {
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
      cursor = cursor[part];
    });
    cursor[last] = value;
  }

  function hashString(input) {
    let h = 1779033703 ^ input.length;
    for (let i = 0; i < input.length; i += 1) {
      h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function mulberry32(seed) {
    return function rng() {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return Math.random().toString(36).slice(2, 8);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function formatNumber(value, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    return Number(value).toFixed(digits);
  }

  function formatSigned(value, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    const formatted = num.toFixed(digits);
    return num > 0 ? `+${formatted}` : formatted;
  }

  function timeLabel(seconds) {
    if (seconds == null || Number.isNaN(seconds)) return '—';
    return `${seconds.toFixed(1)} s`;
  }

  function eventColorForType(type) {
    if (type === 'collision' || type === 'reverse') return '#f5c97b';
    if (type === 'turn') return '#ff9a9a';
    if (type === 'food' || type === 'food-exit') return '#8be9b4';
    return '#7de2cf';
  }

  function downloadBlob(filename, contentType, content) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function syncCanvasForHiDPI(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  class WormSimulation {
    constructor(canvas, config, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.seed = options.seed || randomSeed();
      this.timeScale = options.timeScale || 1;
      this.running = true;
      this.accumulator = 0;
      this.fixedStep = 1 / 60;
      this.highlightCues = { touch: 0, chemo: 0, thermo: 0 };
      this.previewCue = null;
      this.lastSamplePoints = null;
      this.setConfig(config, false);
      this.generateWorld();
      this.reset(true);
    }

    setConfig(config, regenerateWorld = true) {
      this.config = deepClone(config);
      if (regenerateWorld) {
        this.generateWorld();
        this.reset(true);
      }
    }

    setTimeScale(value) {
      this.timeScale = Number(value) || 1;
    }

    generateWorld() {
      const cfg = this.config;
      const rng = mulberry32(hashString(`${this.seed}|world|${cfg.world.obstacleDensity}|${cfg.world.foodRadius}|${cfg.world.temperatureMode}`)());
      const food = {
        x: 72 + (rng() - 0.5) * 8,
        y: 28 + (rng() - 0.5) * 10,
        radius: cfg.world.foodRadius,
        strength: cfg.world.foodStrength
      };
      const obstacleCount = Math.max(0, Math.round(cfg.world.obstacleDensity * 42));
      const obstacles = [];
      let guard = 0;
      while (obstacles.length < obstacleCount && guard < 800) {
        guard += 1;
        const radius = 2.4 + rng() * 4.8;
        const obstacle = {
          x: 12 + rng() * 76,
          y: 12 + rng() * 76,
          r: radius
        };
        const farEnoughFromFood = Math.hypot(obstacle.x - food.x, obstacle.y - food.y) > food.radius + radius + 8;
        const farEnoughFromStart = Math.hypot(obstacle.x - 18, obstacle.y - 72) > radius + 8;
        const overlapsExisting = obstacles.some((item) => Math.hypot(item.x - obstacle.x, item.y - obstacle.y) < item.r + obstacle.r + 3.4);
        if (farEnoughFromFood && farEnoughFromStart && !overlapsExisting) obstacles.push(obstacle);
      }
      const temperatureHotspot = {
        x: 36 + rng() * 28,
        y: 24 + rng() * 42
      };
      this.world = { food, obstacles, temperatureHotspot };
    }

    reset(regenerateWorld = false) {
      if (regenerateWorld) this.generateWorld();
      const cfg = this.config;
      const seedGen = hashString(`${this.seed}|run|${cfg.worm.baseSpeed}|${cfg.behavior.turnProbability}|${cfg.behavior.exploration}`)();
      this.rand = mulberry32(seedGen);
      this.running = true;
      this.accumulator = 0;
      this.metrics = {
        elapsed: 0,
        distance: 0,
        collisions: 0,
        turns: 0,
        reversals: 0,
        foodTime: 0,
        firstFoodTime: null,
        chemoAccum: 0,
        tempErrorAccum: 0,
        samples: 0,
        eventCount: 0
      };
      this.recentEvents = [];
      this.eventMarkers = [];
      this.wasInsideFood = false;
      this.prevChemo = this.sampleFood({ x: 18, y: 72 });
      this.sensor = {
        chemoLeft: 0,
        chemoRight: 0,
        chemoCenter: 0,
        tempCurrent: 0.5,
        tempError: 0,
        touchFront: false,
        touchLeft: false,
        touchRight: false,
        bias: 0
      };
      this.worm = {
        x: 18 + this.rand() * 7,
        y: 72 - this.rand() * 14,
        heading: -0.22 + this.rand() * 0.28,
        state: 'cruise',
        stateTimer: 0,
        turnDir: this.rand() > 0.5 ? 1 : -1,
        lastSpeed: cfg.worm.baseSpeed,
        segments: [],
        trail: []
      };
      for (let i = 0; i < cfg.worm.segmentCount; i += 1) {
        this.worm.segments.push({
          x: this.worm.x - i * 1.2 * Math.cos(this.worm.heading),
          y: this.worm.y - i * 1.2 * Math.sin(this.worm.heading)
        });
      }
      this.lastSamplePoints = this.computeSamplePoints();
      this.worm.trail = [{ x: this.worm.x, y: this.worm.y }];
      this.pushEvent('start', 'Run initialized');
      this.render();
    }

    computeSamplePoints() {
      const sampleDistance = this.config.sensors.sampleDistance;
      const { x, y, heading } = this.worm;
      const leftAngle = heading - 0.58;
      const rightAngle = heading + 0.58;
      return {
        frontPoint: { x: x + Math.cos(heading) * (sampleDistance + 2.2), y: y + Math.sin(heading) * (sampleDistance + 2.2) },
        leftPoint: { x: x + Math.cos(leftAngle) * sampleDistance, y: y + Math.sin(leftAngle) * sampleDistance },
        rightPoint: { x: x + Math.cos(rightAngle) * sampleDistance, y: y + Math.sin(rightAngle) * sampleDistance }
      };
    }

    triggerCue(type) {
      if (!Object.prototype.hasOwnProperty.call(this.highlightCues, type)) return;
      this.highlightCues[type] = 1;
    }

    triggerPreviewCue(type) {
      this.triggerCue(type);
      this.previewCue = { type, until: performance.now() + 1400 };
      this.render();
    }

    tickVisualCues(dt) {
      Object.keys(this.highlightCues).forEach((key) => {
        this.highlightCues[key] = Math.max(0, this.highlightCues[key] - dt * 1.75);
      });
      if (this.previewCue && this.previewCue.until <= performance.now()) this.previewCue = null;
    }

    hasActiveCues() {
      const cueActive = Object.values(this.highlightCues).some((value) => value > 0.01);
      const previewActive = Boolean(this.previewCue && this.previewCue.until > performance.now());
      return cueActive || previewActive;
    }

    pushEvent(type, title) {
      const event = {
        type,
        title,
        time: this.metrics.elapsed,
        x: this.worm ? this.worm.x : 0,
        y: this.worm ? this.worm.y : 0
      };
      this.recentEvents.unshift(event);
      this.recentEvents = this.recentEvents.slice(0, 7);
      this.eventMarkers.unshift(event);
      this.eventMarkers = this.eventMarkers.slice(0, 32);
      this.metrics.eventCount += 1;
    }

    sampleFood(point) {
      const { food } = this.world;
      const dx = point.x - food.x;
      const dy = point.y - food.y;
      const sigma = food.radius * 1.55;
      return food.strength * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }

    sampleTemperature(point) {
      const { temperatureMode, preferredTemperature } = this.config.world;
      if (temperatureMode === 'none') return preferredTemperature;
      if (temperatureMode === 'linear') return clamp(point.x / 100, 0, 1);
      const hotspot = this.world.temperatureHotspot;
      const d = Math.hypot(point.x - hotspot.x, point.y - hotspot.y);
      return clamp(1 - d / 62, 0, 1);
    }

    detectCollision(point) {
      if (point.x < 2 || point.x > 98 || point.y < 2 || point.y > 98) {
        return { hit: true, kind: 'wall' };
      }
      for (const obstacle of this.world.obstacles) {
        if (Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < obstacle.r + 1.2) {
          return { hit: true, kind: 'obstacle' };
        }
      }
      return { hit: false, kind: 'none' };
    }

    startReverse(reason, dir = 0) {
      if (this.worm.state === 'reverse') return;
      this.worm.state = 'reverse';
      this.worm.stateTimer = this.config.worm.reversalDuration;
      this.worm.turnDir = dir || (this.rand() > 0.5 ? 1 : -1);
      this.metrics.reversals += 1;
      this.pushEvent('reverse', reason || 'Reverse');
    }

    startTurn(reason, dir = 0) {
      if (this.worm.state === 'turn') return;
      this.worm.state = 'turn';
      this.worm.stateTimer = 260 + this.rand() * 360;
      this.worm.turnDir = dir || (this.rand() > 0.5 ? 1 : -1);
      this.metrics.turns += 1;
      this.pushEvent('turn', reason || 'Turn');
    }

    move(direction, speed, dt) {
      const next = {
        x: this.worm.x + Math.cos(this.worm.heading) * speed * dt * direction,
        y: this.worm.y + Math.sin(this.worm.heading) * speed * dt * direction
      };
      const collision = this.detectCollision(next);
      if (!collision.hit) {
        const travelled = Math.hypot(next.x - this.worm.x, next.y - this.worm.y);
        this.worm.x = next.x;
        this.worm.y = next.y;
        this.metrics.distance += travelled;
        return collision;
      }
      return collision;
    }

    step(dt) {
      const cfg = this.config;
      const worm = this.worm;
      this.metrics.elapsed += dt;

      const { frontPoint, leftPoint, rightPoint } = this.computeSamplePoints();
      this.lastSamplePoints = { frontPoint, leftPoint, rightPoint };

      const touchFront = cfg.sensors.touch ? this.detectCollision(frontPoint).hit : false;
      const touchLeft = cfg.sensors.touch ? this.detectCollision(leftPoint).hit : false;
      const touchRight = cfg.sensors.touch ? this.detectCollision(rightPoint).hit : false;
      const noise = () => (this.rand() - 0.5) * cfg.sensors.noise * 0.1;
      const chemoLeft = cfg.sensors.chemo ? this.sampleFood(leftPoint) + noise() : 0;
      const chemoRight = cfg.sensors.chemo ? this.sampleFood(rightPoint) + noise() : 0;
      const chemoCenter = cfg.sensors.chemo ? this.sampleFood({ x: worm.x, y: worm.y }) + noise() : 0;
      const tempCurrent = this.sampleTemperature({ x: worm.x, y: worm.y });
      const tempLeft = this.sampleTemperature(leftPoint);
      const tempRight = this.sampleTemperature(rightPoint);
      const tempError = Math.abs(cfg.world.preferredTemperature - tempCurrent);
      const insideFood = Math.hypot(worm.x - this.world.food.x, worm.y - this.world.food.y) <= this.world.food.radius * 0.95;

      this.sensor = {
        chemoLeft,
        chemoRight,
        chemoCenter,
        tempCurrent,
        tempError,
        touchFront,
        touchLeft,
        touchRight,
        bias: this.sensor.bias || 0
      };

      this.metrics.samples += 1;
      this.metrics.chemoAccum += chemoCenter;
      this.metrics.tempErrorAccum += tempError;
      if (insideFood) {
        this.metrics.foodTime += dt;
        if (this.metrics.firstFoodTime == null) this.metrics.firstFoodTime = this.metrics.elapsed;
        if (!this.wasInsideFood) this.pushEvent('food', 'Food patch entered');
      } else if (this.wasInsideFood) {
        this.pushEvent('food-exit', 'Exited food patch');
      }
      this.wasInsideFood = insideFood;

      const chemoBias = cfg.sensors.chemo ? (chemoRight - chemoLeft) : 0;
      const temporalChemo = cfg.sensors.chemo ? chemoCenter - this.prevChemo : 0;
      const thermoBias = (cfg.sensors.thermo && cfg.world.temperatureMode !== 'none')
        ? (Math.abs(cfg.world.preferredTemperature - tempLeft) - Math.abs(cfg.world.preferredTemperature - tempRight))
        : 0;
      const discomfort = (cfg.sensors.thermo && cfg.world.temperatureMode !== 'none')
        ? Math.max(0, tempError - cfg.behavior.discomfort)
        : 0;
      const touchBias = touchLeft && !touchRight ? 1 : (touchRight && !touchLeft ? -1 : 0);
      const randomBias = (this.rand() - 0.5) * cfg.behavior.exploration * 0.36;
      const combinedBias = touchBias * 1.8 + chemoBias * cfg.behavior.gradientGain * 1.35 + thermoBias * cfg.behavior.gradientGain * 1.15 + randomBias;
      this.sensor.bias = combinedBias;

      if (worm.state === 'cruise') {
        if (touchFront) {
          this.metrics.collisions += 1;
          this.pushEvent('collision', 'Contact → reverse');
          this.startReverse('Collision reversal', touchLeft && !touchRight ? 1 : (touchRight && !touchLeft ? -1 : 0));
        } else {
          worm.heading += combinedBias * cfg.worm.turnSharpness * dt * 1.2;
          const turnTrigger = this.rand() < (cfg.behavior.turnProbability * 0.8 + Math.max(0, -temporalChemo) * 0.22 + discomfort * 0.18) * dt * 3;
          if (turnTrigger && Math.abs(combinedBias) > 0.05) {
            this.startTurn('Gradient reorient', combinedBias >= 0 ? 1 : -1);
          } else {
            const speed = cfg.worm.baseSpeed * (insideFood ? 0.82 : 1) * (1 - clamp(tempError * 0.16, 0, 0.18));
            worm.lastSpeed = speed;
            const collision = this.move(1, speed, dt);
            if (collision.hit) {
              this.metrics.collisions += 1;
              this.pushEvent('collision', 'Forward path blocked');
              this.startReverse('Blocked path', this.rand() > 0.5 ? 1 : -1);
            }
          }
        }
      } else if (worm.state === 'reverse') {
        worm.stateTimer -= dt * 1000;
        worm.lastSpeed = cfg.worm.baseSpeed * 0.56;
        const collision = this.move(-1, worm.lastSpeed, dt);
        if (collision.hit) worm.stateTimer = 0;
        worm.heading += worm.turnDir * cfg.worm.turnSharpness * dt * 0.4;
        if (worm.stateTimer <= 0) {
          this.startTurn('Reverse complete', worm.turnDir || (this.rand() > 0.5 ? 1 : -1));
        }
      } else if (worm.state === 'turn') {
        worm.stateTimer -= dt * 1000;
        worm.lastSpeed = cfg.worm.baseSpeed * 0.42;
        worm.heading += worm.turnDir * cfg.worm.turnSharpness * dt * 3.4;
        this.move(1, worm.lastSpeed, dt * 0.42);
        if (worm.stateTimer <= 0) {
          worm.state = 'cruise';
          this.pushEvent('resume', 'Cruise resumed');
        }
      }

      const historyBlend = clamp((dt * 1000) / cfg.sensors.memory, 0.01, 0.4);
      this.prevChemo = lerp(this.prevChemo, chemoCenter, historyBlend);
      worm.heading = (worm.heading + Math.PI * 1000) % (Math.PI * 2);
      this.updateBody();
      worm.trail.push({ x: worm.x, y: worm.y });
      if (worm.trail.length > cfg.visuals.trailLength) worm.trail.splice(0, worm.trail.length - cfg.visuals.trailLength);
    }

    updateBody() {
      const worm = this.worm;
      const cfg = this.config;
      worm.segments[0] = { x: worm.x, y: worm.y };
      const targetDist = clamp(1.15 + (24 - cfg.worm.segmentCount) * 0.02, 0.9, 1.3);
      for (let i = 1; i < worm.segments.length; i += 1) {
        const prev = worm.segments[i - 1];
        const curr = worm.segments[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        curr.x = prev.x + (dx / distance) * targetDist;
        curr.y = prev.y + (dy / distance) * targetDist;
      }
    }

    getMetrics() {
      const samples = Math.max(1, this.metrics.samples);
      return {
        elapsed: this.metrics.elapsed,
        distance: this.metrics.distance,
        collisions: this.metrics.collisions,
        turns: this.metrics.turns,
        reversals: this.metrics.reversals,
        foodTime: this.metrics.foodTime,
        firstFoodTime: this.metrics.firstFoodTime,
        avgChemo: this.metrics.chemoAccum / samples,
        avgTempError: this.metrics.tempErrorAccum / samples,
        eventCount: this.metrics.eventCount
      };
    }

    getSnapshot() {
      return {
        state: this.worm.state,
        position: { x: this.worm.x, y: this.worm.y },
        heading: this.worm.heading,
        speed: this.worm.lastSpeed,
        sensor: { ...this.sensor },
        metrics: this.getMetrics(),
        events: [...this.recentEvents]
      };
    }

    canvasBounds() {
      const rect = this.canvas.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        pad: Math.min(rect.width, rect.height) * 0.06
      };
    }

    worldToScreen(point) {
      const { width, height, pad } = this.canvasBounds();
      const drawableWidth = width - pad * 2;
      const drawableHeight = height - pad * 2;
      return {
        x: pad + (point.x / 100) * drawableWidth,
        y: pad + (point.y / 100) * drawableHeight
      };
    }

    render() {
      syncCanvasForHiDPI(this.canvas);
      const rect = this.canvas.getBoundingClientRect();
      const ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const cfg = this.config;
      const visuals = cfg.visuals;
      const { width, height, pad } = this.canvasBounds();
      const worldTopLeft = { x: pad, y: pad };
      const worldWidth = width - pad * 2;
      const worldHeight = height - pad * 2;
      const { frontPoint, leftPoint, rightPoint } = this.lastSamplePoints || this.computeSamplePoints();
      const cueTouch = this.highlightCues.touch || 0;
      const cueChemo = this.highlightCues.chemo || 0;
      const cueThermo = this.highlightCues.thermo || 0;
      const previewType = this.previewCue && this.previewCue.until > performance.now() ? this.previewCue.type : null;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);

      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, 'rgba(10,14,20,0.98)');
      bgGradient.addColorStop(1, 'rgba(8,12,18,1)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      if (!visuals.cleanMode) {
        ctx.strokeStyle = 'rgba(168, 184, 216, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
      }

      if (cueTouch > 0.01 || previewType === 'touch') {
        ctx.strokeStyle = `rgba(245, 201, 123, ${0.16 + cueTouch * 0.42 + (previewType === 'touch' ? 0.18 : 0)})`;
        ctx.lineWidth = 2 + cueTouch * 2.4;
        ctx.shadowColor = 'rgba(245, 201, 123, 0.26)';
        ctx.shadowBlur = 16 * Math.max(cueTouch, previewType === 'touch' ? 0.55 : 0);
        ctx.strokeRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
        ctx.shadowBlur = 0;
      }

      const showChemicalOverlay = visuals.showChemicalOverlay || previewType === 'chemo' || cueChemo > 0.01;
      if (showChemicalOverlay) {
        const foodScreen = this.worldToScreen(this.world.food);
        const maxRadius = (this.world.food.radius / 100) * Math.max(worldWidth, worldHeight) * 4.6;
        const cueBoost = cueChemo * 0.22 + (previewType === 'chemo' ? 0.18 : 0);
        const gradient = ctx.createRadialGradient(foodScreen.x, foodScreen.y, 0, foodScreen.x, foodScreen.y, maxRadius);
        gradient.addColorStop(0, `rgba(122, 242, 176, ${0.24 * visuals.overlayOpacity + 0.08 + cueBoost})`);
        gradient.addColorStop(0.3, `rgba(110, 217, 165, ${0.12 * visuals.overlayOpacity + 0.04 + cueBoost * 0.5})`);
        gradient.addColorStop(1, 'rgba(80, 140, 110, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
      }

      const showTemperatureOverlay = (cfg.world.temperatureMode !== 'none' && visuals.showTemperatureOverlay) || previewType === 'thermo' || cueThermo > 0.01;
      if (showTemperatureOverlay) {
        const renderMode = cfg.world.temperatureMode !== 'none' ? cfg.world.temperatureMode : 'linear';
        const cueAlpha = cueThermo * 0.18 + (previewType === 'thermo' ? 0.16 : 0);
        ctx.globalAlpha = clamp(visuals.overlayOpacity + 0.06 + cueAlpha, 0, 1);
        if (renderMode === 'linear') {
          const grad = ctx.createLinearGradient(worldTopLeft.x, worldTopLeft.y, worldTopLeft.x + worldWidth, worldTopLeft.y);
          grad.addColorStop(0, 'rgba(80,120,255,0.14)');
          grad.addColorStop(0.5, 'rgba(124,168,255,0.03)');
          grad.addColorStop(1, 'rgba(255,176,96,0.18)');
          ctx.fillStyle = grad;
          ctx.fillRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
          const prefX = worldTopLeft.x + worldWidth * cfg.world.preferredTemperature;
          ctx.strokeStyle = `rgba(214, 229, 255, ${0.34 + cueThermo * 0.28 + (previewType === 'thermo' ? 0.18 : 0)})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(prefX, worldTopLeft.y);
          ctx.lineTo(prefX, worldTopLeft.y + worldHeight);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const hotspot = this.worldToScreen(this.world.temperatureHotspot);
          const radial = ctx.createRadialGradient(hotspot.x, hotspot.y, 0, hotspot.x, hotspot.y, Math.max(worldWidth, worldHeight) * 0.62);
          radial.addColorStop(0, 'rgba(255,185,98,0.18)');
          radial.addColorStop(0.35, 'rgba(163,186,255,0.08)');
          radial.addColorStop(1, 'rgba(90,118,255,0)');
          ctx.fillStyle = radial;
          ctx.fillRect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
          if (cueThermo > 0.01 || previewType === 'thermo') {
            ctx.beginPath();
            ctx.arc(hotspot.x, hotspot.y, 42 + pulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(210, 227, 255, ${0.3 + cueThermo * 0.28 + (previewType === 'thermo' ? 0.18 : 0)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      const foodCenter = this.worldToScreen(this.world.food);
      ctx.fillStyle = 'rgba(95, 196, 146, 0.16)';
      ctx.beginPath();
      ctx.arc(foodCenter.x, foodCenter.y, (this.world.food.radius / 100) * Math.min(worldWidth, worldHeight) * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(146, 243, 185, 0.36)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (cueChemo > 0.01 || previewType === 'chemo') {
        ctx.beginPath();
        ctx.arc(foodCenter.x, foodCenter.y, (this.world.food.radius / 100) * Math.min(worldWidth, worldHeight) * (1.42 + pulse * 0.08), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(166, 255, 205, ${0.28 + cueChemo * 0.36 + (previewType === 'chemo' ? 0.18 : 0)})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(122, 242, 176, 0.28)';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      this.world.obstacles.forEach((obstacle) => {
        const point = this.worldToScreen(obstacle);
        const radius = (obstacle.r / 100) * Math.min(worldWidth, worldHeight);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = cueTouch > 0.01 || previewType === 'touch'
          ? `rgba(116, 126, 144, ${0.18 + cueTouch * 0.1 + (previewType === 'touch' ? 0.06 : 0)})`
          : 'rgba(116, 126, 144, 0.16)';
        ctx.fill();
        ctx.strokeStyle = cueTouch > 0.01 || previewType === 'touch'
          ? `rgba(255, 221, 154, ${0.28 + cueTouch * 0.34 + (previewType === 'touch' ? 0.12 : 0)})`
          : 'rgba(161, 173, 193, 0.18)';
        ctx.lineWidth = cueTouch > 0.01 || previewType === 'touch' ? 2 : 1;
        ctx.stroke();
      });

      if (visuals.showTrail && this.worm.trail.length > 1) {
        ctx.beginPath();
        this.worm.trail.forEach((point, index) => {
          const screen = this.worldToScreen(point);
          if (index === 0) ctx.moveTo(screen.x, screen.y);
          else ctx.lineTo(screen.x, screen.y);
        });
        ctx.strokeStyle = 'rgba(130, 205, 190, 0.24)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      if (visuals.showEventMarkers) {
        this.eventMarkers.slice(0, 20).forEach((event, index) => {
          const point = this.worldToScreen(event);
          const alpha = clamp(0.45 - index * 0.02, 0.1, 0.45);
          const color = event.type === 'collision' ? `rgba(255, 140, 140, ${alpha})`
            : event.type === 'turn' ? `rgba(255, 204, 116, ${alpha})`
            : `rgba(125, 226, 207, ${alpha})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4.4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
      }

      const segmentPoints = this.worm.segments.map((segment, index, arr) => {
        const base = this.worldToScreen(segment);
        const prev = arr[Math.max(0, index - 1)];
        const next = arr[Math.min(arr.length - 1, index + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const length = Math.hypot(dx, dy) || 1;
        const px = -dy / length;
        const py = dx / length;
        const amplitude = (this.worm.state === 'turn' ? 5.2 : 3.4) * (1 - index / arr.length * 0.92);
        const direction = this.worm.state === 'reverse' ? -1 : 1;
        const wave = Math.sin(this.metrics.elapsed * 10 * direction - index * 0.68) * amplitude;
        return {
          x: base.x + px * wave,
          y: base.y + py * wave
        };
      });

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      segmentPoints.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = this.worm.state === 'reverse'
        ? 'rgba(245, 201, 123, 0.95)'
        : this.worm.state === 'turn'
          ? 'rgba(255, 160, 160, 0.96)'
          : 'rgba(126, 226, 207, 0.96)';
      ctx.lineWidth = clamp(4.4 + this.config.worm.segmentCount * 0.13, 6, 10.5);
      ctx.shadowColor = 'rgba(76, 178, 163, 0.22)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const head = segmentPoints[0];
      ctx.beginPath();
      ctx.arc(head.x, head.y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(242, 247, 255, 0.9)';
      ctx.fill();

      const showSensorPoints = visuals.showSensors || cueTouch > 0.01 || cueChemo > 0.01 || cueThermo > 0.01 || Boolean(previewType);
      if (showSensorPoints) {
        const headWorld = this.worldToScreen({ x: this.worm.x, y: this.worm.y });
        if (cueChemo > 0.01 || cueTouch > 0.01 || cueThermo > 0.01 || previewType) {
          [leftPoint, rightPoint, frontPoint].forEach((point) => {
            const screen = this.worldToScreen(point);
            ctx.beginPath();
            ctx.moveTo(headWorld.x, headWorld.y);
            ctx.lineTo(screen.x, screen.y);
            const guideColor = previewType === 'touch'
              ? `rgba(255, 221, 154, ${0.26 + pulse * 0.22})`
              : previewType === 'thermo'
                ? `rgba(190, 213, 255, ${0.24 + pulse * 0.18})`
                : `rgba(166, 255, 205, ${0.24 + pulse * 0.18})`;
            ctx.strokeStyle = guideColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
        }

        [
          {
            point: leftPoint,
            color: previewType === 'chemo' || cueChemo > 0.01
              ? `rgba(166, 255, 205, ${0.76 + pulse * 0.12})`
              : previewType === 'thermo' || cueThermo > 0.01
                ? `rgba(190, 213, 255, ${0.76 + pulse * 0.12})`
                : 'rgba(156, 184, 255, 0.9)'
          },
          {
            point: rightPoint,
            color: previewType === 'chemo' || cueChemo > 0.01
              ? `rgba(166, 255, 205, ${0.76 + pulse * 0.12})`
              : previewType === 'thermo' || cueThermo > 0.01
                ? `rgba(190, 213, 255, ${0.76 + pulse * 0.12})`
                : 'rgba(156, 184, 255, 0.9)'
          },
          {
            point: frontPoint,
            color: previewType === 'touch' || cueTouch > 0.01
              ? `rgba(255, 221, 154, ${0.76 + pulse * 0.12})`
              : previewType === 'thermo' || cueThermo > 0.01
                ? `rgba(190, 213, 255, ${0.76 + pulse * 0.12})`
                : 'rgba(245, 201, 123, 0.9)'
          }
        ].forEach(({ point, color }) => {
          const screen = this.worldToScreen(point);
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, previewType || cueTouch > 0.01 || cueChemo > 0.01 || cueThermo > 0.01 ? 5.2 + pulse * 0.6 : 4.2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = previewType || cueTouch > 0.01 || cueChemo > 0.01 || cueThermo > 0.01 ? 16 : 0;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }
    }
  }


  const app = {
    state: {
      currentView: 'lab',
      settings: {
        highContrast: false,
        reducedMotion: false,
        showOnboarding: true,
        compareDefaultLayout: '2x1'
      },
      lab: {
        appliedConfig: deepClone(DEFAULT_CONFIG),
        draftConfig: deepClone(DEFAULT_CONFIG),
        dirtyPaths: new Set(),
        visualDirtyPaths: new Set(),
        sim: null,
        running: true,
        timeScale: 1,
        seedLocked: true,
        appliedSeed: randomSeed(),
        draftSeed: null,
        visualFeedbackUntil: 0
      },
      compare: {
        baselineConfig: deepClone(DEFAULT_CONFIG),
        variantApplied: deepClone(DEFAULT_CONFIG),
        variantDraft: deepClone(DEFAULT_CONFIG),
        dirtyPaths: new Set(),
        simA: null,
        simB: null,
        running: true,
        timeScale: 1,
        seedLocked: true,
        seed: randomSeed(),
        layout: '2x1'
      },
      savedRuns: []
    },

    init() {
      this.cacheElements();
      this.loadStorage();
      this.bindNavigation();
      this.bindLanding();
      this.bindLabControls();
      this.bindLabRunbar();
      this.bindLabSectionActions();
      this.bindCompareControls();
      this.bindSettings();
      this.renderPresetLibrary();
      this.renderSavedRuns();
      this.renderLegend();
      this.syncLabControlsFromState();
      this.syncCompareControlsFromState();
      this.createLabSimulation();
      this.syncCompareFromLab();
      this.applySettingsToBody();
      this.handleViewportWarning();
      this.renderAll();
      this.showContinueLastIfNeeded();
      if (!this.state.settings.showOnboarding) this.hideLandingOverlay();
      window.addEventListener('resize', () => {
        this.handleViewportWarning();
        this.renderAll();
      });
      this.startLoop();
    },

    cacheElements() {
      this.els = {
        navButtons: Array.from(document.querySelectorAll('.nav-btn')),
        views: Array.from(document.querySelectorAll('.view')),
        landingOverlay: $('landingOverlay'),
        quickStartBtn: $('quickStartBtn'),
        openLibraryBtn: $('openLibraryBtn'),
        showConceptBtn: $('showConceptBtn'),
        continueLastWrap: $('continueLastWrap'),
        continueLastBtn: $('continueLastBtn'),
        viewportWarning: $('viewportWarning'),
        toastContainer: $('toastContainer'),
        dirtyBadge: $('dirtyBadge'),
        livePendingCount: $('livePendingCount'),
        modelPendingCount: $('modelPendingCount'),
        pendingCountLabel: $('pendingCountLabel'),
        pendingChangedFields: $('pendingChangedFields'),
        monitorStatePill: $('monitorStatePill'),
        currentExplanation: $('currentExplanation'),
        labMetricStrip: $('labMetricStrip'),
        stateSummaryGrid: $('stateSummaryGrid'),
        sensorSummaryGrid: $('sensorSummaryGrid'),
        recentEventsList: $('recentEventsList'),
        legendGrid: $('legendGrid'),
        presetGrid: $('presetGrid'),
        savedGrid: $('savedGrid'),
        labCanvas: $('labCanvas'),
        compareCanvasA: $('compareCanvasA'),
        compareCanvasB: $('compareCanvasB'),
        labPlayBtn: $('labPlayBtn'),
        labStepBtn: $('labStepBtn'),
        labResetRunBtn: $('labResetRunBtn'),
        labResetConfigBtn: $('labResetConfigBtn'),
        applySensorsBtn: $('applySensorsBtn'),
        applyWormBtn: $('applyWormBtn'),
        applyBehaviorBtn: $('applyBehaviorBtn'),
        applyEnvironmentBtn: $('applyEnvironmentBtn'),
        applyVisualsBtn: $('applyVisualsBtn'),
        applySeedBtn: $('applySeedBtn'),
        seedLockInput: $('seedLockInput'),
        seedInput: $('seedInput'),
        regenSeedBtn: $('regenSeedBtn'),
        labTimeScaleSelect: $('labTimeScaleSelect'),
        compareCurrentBtn: $('compareCurrentBtn'),
        saveConfigBtn: $('saveConfigBtn'),
        exportJsonBtn: $('exportJsonBtn'),
        compareMetricsA: $('compareMetricsA'),
        compareMetricsB: $('compareMetricsB'),
        compareDirtyBadge: $('compareDirtyBadge'),
        compareRunBtn: $('compareRunBtn'),
        compareStepBtn: $('compareStepBtn'),
        compareResetBtn: $('compareResetBtn'),
        compareApplyBtn: $('compareApplyBtn'),
        compareSeedLockInput: $('compareSeedLockInput'),
        compareSeedInput: $('compareSeedInput'),
        compareTimeScaleSelect: $('compareTimeScaleSelect'),
        compareChangedFields: $('compareChangedFields'),
        deltaMetrics: $('deltaMetrics'),
        compareLayoutRoot: $('compareLayoutRoot'),
        compareLayout2x1Btn: $('compareLayout2x1Btn'),
        compareLayout2x2Btn: $('compareLayout2x2Btn'),
        settingHighContrast: $('settingHighContrast'),
        settingReducedMotion: $('settingReducedMotion'),
        settingShowOnboarding: $('settingShowOnboarding'),
        settingCompareDefaultLayout: $('settingCompareDefaultLayout')
      };
    },

    loadStorage() {
      try {
        const saves = JSON.parse(localStorage.getItem(STORAGE_KEYS.saves) || '[]');
        this.state.savedRuns = Array.isArray(saves) ? saves : [];
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
        this.state.settings = { ...this.state.settings, ...settings };
        const lastLab = JSON.parse(localStorage.getItem(STORAGE_KEYS.lastLab) || 'null');
        if (lastLab && lastLab.config && lastLab.seed) {
          this.state.lab.appliedConfig = deepClone(lastLab.config);
          this.state.lab.draftConfig = deepClone(lastLab.config);
          this.state.lab.appliedSeed = lastLab.seed;
          this.state.lab.draftSeed = lastLab.seed;
        }
      } catch (error) {
        console.warn('Failed to load local storage', error);
      }
      this.state.compare.layout = this.state.settings.compareDefaultLayout || '2x1';
      if (!this.state.lab.draftSeed) this.state.lab.draftSeed = this.state.lab.appliedSeed;
    },

    persistSettings() {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.state.settings));
    },

    persistLastLab() {
      localStorage.setItem(STORAGE_KEYS.lastLab, JSON.stringify({
        config: this.state.lab.appliedConfig,
        seed: this.state.lab.appliedSeed
      }));
    },

    toast(message) {
      const element = document.createElement('div');
      element.className = 'toast';
      element.textContent = message;
      this.els.toastContainer.appendChild(element);
      setTimeout(() => element.remove(), 2600);
    },

    bindNavigation() {
      this.els.navButtons.forEach((button) => {
        button.addEventListener('click', () => this.switchView(button.dataset.nav));
      });
    },

    bindLanding() {
      this.els.quickStartBtn.addEventListener('click', () => {
        this.hideLandingOverlay();
        this.switchView('lab');
        this.toast('Food Seeking preset으로 시작합니다.');
      });
      this.els.openLibraryBtn.addEventListener('click', () => {
        this.hideLandingOverlay();
        this.switchView('library');
      });
      this.els.showConceptBtn.addEventListener('click', () => {
        this.toast('전진이 기본값이고, 충돌·기울기 변화가 방향 전환을 유도합니다.');
      });
      this.els.continueLastBtn.addEventListener('click', () => {
        this.hideLandingOverlay();
        this.switchView('lab');
        this.toast('최근 실험을 이어서 불러왔습니다.');
      });
    },

    showContinueLastIfNeeded() {
      const lastLab = localStorage.getItem(STORAGE_KEYS.lastLab);
      if (lastLab) this.els.continueLastWrap.classList.remove('hidden');
    },

    hideLandingOverlay() {
      if (this.els.landingOverlay) this.els.landingOverlay.classList.add('hidden');
    },

    switchView(viewName) {
      this.state.currentView = viewName;
      this.els.views.forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
      this.els.navButtons.forEach((button) => button.classList.toggle('active', button.dataset.nav === viewName));
      this.renderAll();
    },

    handleViewportWarning() {
      this.els.viewportWarning.classList.toggle('hidden', window.innerWidth >= 1360);
    },

    bindLabControls() {
      LAB_BINDINGS.forEach((binding) => {
        const input = $(binding.id);
        if (!input) return;
        const eventName = binding.type === 'checkbox' ? 'change' : 'input';
        input.addEventListener(eventName, () => {
          const value = binding.type === 'checkbox'
            ? input.checked
            : (binding.type === 'select' ? input.value : Number(input.value));
          setByPath(this.state.lab.draftConfig, binding.path, value);
          this.updateLabPathDirtyState(binding.path, { visual: Boolean(binding.liveApply) });

          if (binding.path === 'sensors.touch') this.triggerLabSensorCue('touch');
          if (binding.path === 'sensors.chemo') this.triggerLabSensorCue('chemo');
          if (binding.path === 'sensors.thermo') this.triggerLabSensorCue('thermo');

          this.updateInputDisplay(binding, value);
          this.updateToggleChipStates();
          this.renderLabDirtyState();
        });
      });
    },

    bindLabRunbar() {
      this.els.labPlayBtn.addEventListener('click', () => {
        this.state.lab.running = !this.state.lab.running;
        if (this.state.lab.sim) this.state.lab.sim.running = this.state.lab.running;
        this.renderTopbarStatus();
      });

      this.els.labStepBtn.addEventListener('click', () => {
        this.state.lab.running = false;
        if (this.state.lab.sim) {
          this.state.lab.sim.running = false;
          this.state.lab.sim.step(1 / 30);
          this.state.lab.sim.render();
        }
        this.renderAll();
      });

      this.els.labResetRunBtn.addEventListener('click', () => {
        if (!this.state.lab.seedLocked) {
          const nextSeed = randomSeed();
          this.state.lab.appliedSeed = nextSeed;
          this.state.lab.draftSeed = nextSeed;
          this.state.lab.dirtyPaths.delete('seed');
        }
        this.createLabSimulation();
        this.syncLabControlsFromState();
        this.toast('현재 적용된 조건으로 run을 재시작했습니다.');
      });

      this.els.labResetConfigBtn.addEventListener('click', () => {
        this.state.lab.appliedConfig = deepClone(DEFAULT_CONFIG);
        this.state.lab.draftConfig = deepClone(DEFAULT_CONFIG);
        this.state.lab.dirtyPaths.clear();
        this.state.lab.visualDirtyPaths.clear();
        const nextSeed = randomSeed();
        this.state.lab.appliedSeed = nextSeed;
        this.state.lab.draftSeed = nextSeed;
        this.syncLabControlsFromState();
        this.createLabSimulation();
        this.toast('Config를 기본값으로 초기화했습니다.');
      });

      this.els.seedLockInput.addEventListener('change', () => {
        this.state.lab.seedLocked = this.els.seedLockInput.checked;
      });

      this.els.seedInput.addEventListener('change', () => {
        this.state.lab.draftSeed = this.els.seedInput.value.trim() || randomSeed();
        this.els.seedInput.value = this.state.lab.draftSeed;
        this.updateLabPathDirtyState('seed');
        this.renderLabDirtyState();
      });

      this.els.regenSeedBtn.addEventListener('click', () => {
        this.state.lab.draftSeed = randomSeed();
        this.els.seedInput.value = this.state.lab.draftSeed;
        this.updateLabPathDirtyState('seed');
        this.renderLabDirtyState();
      });

      this.els.labTimeScaleSelect.addEventListener('change', () => {
        this.state.lab.timeScale = Number(this.els.labTimeScaleSelect.value);
        if (this.state.lab.sim) this.state.lab.sim.setTimeScale(this.state.lab.timeScale);
      });

      this.els.compareCurrentBtn.addEventListener('click', () => {
        this.syncCompareFromLab();
        this.switchView('compare');
        this.toast('Lab의 현재 적용 config를 Compare 기준으로 복사했습니다.');
      });

      this.els.saveConfigBtn.addEventListener('click', () => {
        const metrics = this.state.lab.sim ? this.state.lab.sim.getMetrics() : null;
        const entry = {
          id: `save-${Date.now()}`,
          name: `${this.state.lab.appliedConfig.presetName || 'Custom'} · ${new Date().toLocaleString('ko-KR')}`,
          config: deepClone(this.state.lab.appliedConfig),
          seed: this.state.lab.appliedSeed,
          createdAt: Date.now(),
          metrics
        };
        this.state.savedRuns.unshift(entry);
        this.state.savedRuns = this.state.savedRuns.slice(0, 24);
        localStorage.setItem(STORAGE_KEYS.saves, JSON.stringify(this.state.savedRuns));
        this.renderSavedRuns();
        this.toast('현재 config를 로컬에 저장했습니다.');
      });

      this.els.exportJsonBtn.addEventListener('click', () => {
        const payload = {
          config: this.state.lab.appliedConfig,
          draftConfig: this.state.lab.draftConfig,
          appliedSeed: this.state.lab.appliedSeed,
          draftSeed: this.state.lab.draftSeed,
          metrics: this.state.lab.sim ? this.state.lab.sim.getMetrics() : null,
          snapshot: this.state.lab.sim ? this.state.lab.sim.getSnapshot() : null
        };
        downloadBlob('nema-lab-run.json', 'application/json', JSON.stringify(payload, null, 2));
      });
    },

    bindLabSectionActions() {
      const mapping = {
        applySensorsBtn: 'sensors',
        applyWormBtn: 'worm',
        applyBehaviorBtn: 'behavior',
        applyEnvironmentBtn: 'environment',
        applyVisualsBtn: 'visuals',
        applySeedBtn: 'seed'
      };
      Object.entries(mapping).forEach(([elementKey, section]) => {
        const element = this.els[elementKey];
        if (!element) return;
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.applyLabSection(section);
        });
      });
    },

    bindCompareControls() {
      COMPARE_BINDINGS.forEach((binding) => {
        const input = $(binding.id);
        if (!input) return;
        const eventName = binding.type === 'checkbox' ? 'change' : 'input';
        input.addEventListener(eventName, () => {
          const value = binding.type === 'checkbox' ? input.checked : Number(input.value);
          setByPath(this.state.compare.variantDraft, binding.path, value);
          const baselineValue = getByPath(this.state.compare.baselineConfig, binding.path);
          if (value === baselineValue) this.state.compare.dirtyPaths.delete(binding.path);
          else this.state.compare.dirtyPaths.add(binding.path);
          if (binding.path === 'sensors.chemo') this.triggerCompareSensorCue('chemo');
          if (binding.path === 'sensors.thermo') this.triggerCompareSensorCue('thermo');
          this.updateInputDisplay(binding, value);
          this.updateToggleChipStates();
          this.renderCompareDirtyState();
        });
      });

      this.els.compareRunBtn.addEventListener('click', () => {
        this.state.compare.running = !this.state.compare.running;
        if (this.state.compare.simA) this.state.compare.simA.running = this.state.compare.running;
        if (this.state.compare.simB) this.state.compare.simB.running = this.state.compare.running;
        this.renderTopbarStatus();
      });

      this.els.compareStepBtn.addEventListener('click', () => {
        this.state.compare.running = false;
        [this.state.compare.simA, this.state.compare.simB].forEach((sim) => {
          if (!sim) return;
          sim.running = false;
          sim.step(1 / 30);
          sim.render();
        });
        this.renderAll();
      });

      this.els.compareResetBtn.addEventListener('click', () => {
        if (!this.state.compare.seedLocked) {
          this.state.compare.seed = randomSeed();
          this.els.compareSeedInput.value = this.state.compare.seed;
        }
        this.createCompareSimulations();
        this.toast('Compare run을 현재 적용 조건으로 초기화했습니다.');
      });

      this.els.compareApplyBtn.addEventListener('click', () => {
        if (!this.state.compare.dirtyPaths.size) return;
        this.state.compare.variantApplied = deepClone(this.state.compare.variantDraft);
        this.state.compare.dirtyPaths.clear();
        this.createCompareSimulations();
        this.renderCompareDirtyState();
        this.toast('Variant B 변경사항을 반영했습니다.');
      });

      this.els.compareSeedLockInput.addEventListener('change', () => {
        this.state.compare.seedLocked = this.els.compareSeedLockInput.checked;
      });

      this.els.compareSeedInput.addEventListener('change', () => {
        this.state.compare.seed = this.els.compareSeedInput.value.trim() || randomSeed();
        this.els.compareSeedInput.value = this.state.compare.seed;
      });

      this.els.compareTimeScaleSelect.addEventListener('change', () => {
        this.state.compare.timeScale = Number(this.els.compareTimeScaleSelect.value);
        [this.state.compare.simA, this.state.compare.simB].forEach((sim) => {
          if (sim) sim.setTimeScale(this.state.compare.timeScale);
        });
      });

      this.els.compareLayout2x1Btn.addEventListener('click', () => {
        this.state.compare.layout = '2x1';
        this.state.settings.compareDefaultLayout = '2x1';
        this.persistSettings();
        this.renderCompareLayout();
      });

      this.els.compareLayout2x2Btn.addEventListener('click', () => {
        this.state.compare.layout = '2x2';
        this.state.settings.compareDefaultLayout = '2x2';
        this.persistSettings();
        this.renderCompareLayout();
      });
    },

    bindSettings() {
      this.els.settingHighContrast.addEventListener('change', () => {
        this.state.settings.highContrast = this.els.settingHighContrast.checked;
        this.applySettingsToBody();
        this.persistSettings();
      });
      this.els.settingReducedMotion.addEventListener('change', () => {
        this.state.settings.reducedMotion = this.els.settingReducedMotion.checked;
        this.applySettingsToBody();
        this.persistSettings();
      });
      this.els.settingShowOnboarding.addEventListener('change', () => {
        this.state.settings.showOnboarding = this.els.settingShowOnboarding.checked;
        if (this.state.settings.showOnboarding) this.els.landingOverlay.classList.remove('hidden');
        else this.els.landingOverlay.classList.add('hidden');
        this.persistSettings();
      });
      this.els.settingCompareDefaultLayout.addEventListener('change', () => {
        this.state.settings.compareDefaultLayout = this.els.settingCompareDefaultLayout.value;
        this.state.compare.layout = this.state.settings.compareDefaultLayout;
        this.persistSettings();
        this.renderCompareLayout();
      });
    },

    applySettingsToBody() {
      document.body.classList.toggle('high-contrast', this.state.settings.highContrast);
      document.body.classList.toggle('reduced-motion', this.state.settings.reducedMotion);
      this.els.settingHighContrast.checked = this.state.settings.highContrast;
      this.els.settingReducedMotion.checked = this.state.settings.reducedMotion;
      this.els.settingShowOnboarding.checked = this.state.settings.showOnboarding;
      this.els.settingCompareDefaultLayout.value = this.state.compare.layout;
    },

    updateInputDisplay(binding, value) {
      const display = document.querySelector(`[data-display-for="${binding.id}"]`);
      if (!display) return;
      if (binding.type === 'checkbox') display.textContent = value ? 'ON' : 'OFF';
      else if (binding.format) display.textContent = binding.format(value);
      else display.textContent = `${value}`;
    },

    updateToggleChipStates() {
      document.querySelectorAll('.toggle-chip').forEach((chip) => {
        const input = chip.querySelector('input[type="checkbox"]');
        if (!input) return;
        chip.classList.toggle('is-on', input.checked);
      });
    },

    updateLabPathDirtyState(path, options = {}) {
      const { visual = false } = options;
      const targetSet = visual ? this.state.lab.visualDirtyPaths : this.state.lab.dirtyPaths;
      const draftValue = path === 'seed'
        ? this.state.lab.draftSeed
        : getByPath(this.state.lab.draftConfig, path);
      const appliedValue = path === 'seed'
        ? this.state.lab.appliedSeed
        : getByPath(this.state.lab.appliedConfig, path);
      if (draftValue === appliedValue) targetSet.delete(path);
      else targetSet.add(path);
    },

    flashSensorChip(sensorKey) {
      document.querySelectorAll(`[data-sensor-chip="${sensorKey}"]`).forEach((chip) => {
        chip.classList.remove('sensor-previewing');
        void chip.offsetWidth;
        chip.classList.add('sensor-previewing');
        window.setTimeout(() => chip.classList.remove('sensor-previewing'), 760);
      });
    },

    triggerLabSensorCue(sensorKey) {
      this.flashSensorChip(sensorKey);
      if (this.state.lab.sim) this.state.lab.sim.triggerPreviewCue(sensorKey);
    },

    triggerCompareSensorCue(sensorKey) {
      this.flashSensorChip(sensorKey);
      if (this.state.compare.simB) this.state.compare.simB.triggerPreviewCue(sensorKey);
    },

    getDirtyPathsForSection(section) {
      const matcher = LAB_SECTION_RULES[section];
      if (!matcher) return [];
      const source = section === 'visuals' ? this.state.lab.visualDirtyPaths : this.state.lab.dirtyPaths;
      return Array.from(source).filter((path) => matcher(path));
    },

    setSectionApplyButton(button, isDirty, options = {}) {
      if (!button) return;
      const { immediate = false, feedback = false } = options;
      button.classList.remove('ready', 'applied', 'live-active');
      if (immediate) {
        button.disabled = !isDirty;
        button.classList.toggle('ready', isDirty);
        button.classList.toggle('live-active', !isDirty && feedback);
        button.classList.toggle('applied', !isDirty && !feedback);
        button.textContent = isDirty ? '변경사항 적용' : (feedback ? '방금 반영됨' : '적용됨');
        return;
      }
      button.disabled = !isDirty;
      button.classList.toggle('ready', isDirty);
      button.classList.toggle('applied', !isDirty);
      button.textContent = isDirty ? '변경사항 적용' : '적용됨';
    },

    applyLabSection(section) {
      const dirtyPaths = this.getDirtyPathsForSection(section);
      if (!dirtyPaths.length) return;

      if (section === 'visuals') {
        dirtyPaths.forEach((path) => {
          setByPath(this.state.lab.appliedConfig, path, deepClone(getByPath(this.state.lab.draftConfig, path)));
          this.state.lab.visualDirtyPaths.delete(path);
        });
        if (this.state.lab.sim) {
          this.state.lab.sim.setConfig(this.state.lab.appliedConfig, false);
          this.state.lab.sim.render();
        }
        this.state.lab.visualFeedbackUntil = performance.now() + 1200;
        this.renderLabDirtyState();
        this.persistLastLab();
        this.renderAll();
        this.toast('Visuals 변경사항을 현재 run에 반영했습니다.');
        return;
      }

      if (section === 'seed') {
        this.state.lab.appliedSeed = this.state.lab.draftSeed;
      } else {
        dirtyPaths.forEach((path) => {
          setByPath(this.state.lab.appliedConfig, path, deepClone(getByPath(this.state.lab.draftConfig, path)));
        });
      }
      dirtyPaths.forEach((path) => this.state.lab.dirtyPaths.delete(path));
      this.createLabSimulation();
      this.renderLabDirtyState();
      this.persistLastLab();
      this.toast(`${SECTION_LABELS[section]} 변경사항을 반영했습니다.`);
    },

    syncLabControlsFromState() {
      LAB_BINDINGS.forEach((binding) => {
        const input = $(binding.id);
        if (!input) return;
        const value = getByPath(this.state.lab.draftConfig, binding.path);
        if (binding.type === 'checkbox') input.checked = Boolean(value);
        else input.value = value;
        this.updateInputDisplay(binding, value);
      });
      this.els.seedInput.value = this.state.lab.draftSeed || this.state.lab.appliedSeed;
      this.els.seedLockInput.checked = this.state.lab.seedLocked;
      this.els.labTimeScaleSelect.value = String(this.state.lab.timeScale);
      this.updateToggleChipStates();
      this.renderLabDirtyState();
    },

    syncCompareControlsFromState() {
      COMPARE_BINDINGS.forEach((binding) => {
        const input = $(binding.id);
        if (!input) return;
        const value = getByPath(this.state.compare.variantDraft, binding.path);
        if (binding.type === 'checkbox') input.checked = Boolean(value);
        else input.value = value;
        this.updateInputDisplay(binding, value);
      });
      this.els.compareSeedInput.value = this.state.compare.seed;
      this.els.compareSeedLockInput.checked = this.state.compare.seedLocked;
      this.els.compareTimeScaleSelect.value = String(this.state.compare.timeScale);
      this.updateToggleChipStates();
      this.renderCompareDirtyState();
    },

    createLabSimulation() {
      this.state.lab.sim = new WormSimulation(this.els.labCanvas, this.state.lab.appliedConfig, {
        seed: this.state.lab.appliedSeed,
        timeScale: this.state.lab.timeScale
      });
      this.state.lab.sim.running = this.state.lab.running;
      this.persistLastLab();
      this.renderAll();
    },

    syncCompareFromLab() {
      this.state.compare.baselineConfig = deepClone(this.state.lab.appliedConfig);
      this.state.compare.variantApplied = deepClone(this.state.lab.appliedConfig);
      this.state.compare.variantDraft = deepClone(this.state.lab.appliedConfig);
      this.state.compare.seed = this.state.lab.appliedSeed;
      this.state.compare.timeScale = this.state.lab.timeScale;
      this.state.compare.dirtyPaths.clear();
      this.syncCompareControlsFromState();
      this.createCompareSimulations();
      this.renderCompareLayout();
    },

    createCompareSimulations() {
      this.state.compare.simA = new WormSimulation(this.els.compareCanvasA, this.state.compare.baselineConfig, {
        seed: this.state.compare.seed,
        timeScale: this.state.compare.timeScale
      });
      this.state.compare.simB = new WormSimulation(this.els.compareCanvasB, this.state.compare.variantApplied, {
        seed: this.state.compare.seed,
        timeScale: this.state.compare.timeScale
      });
      this.state.compare.simA.running = this.state.compare.running;
      this.state.compare.simB.running = this.state.compare.running;
      this.renderAll();
    },

    renderLegend() {
      this.els.legendGrid.innerHTML = LEGEND_ITEMS.map((item) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${item.color}"></span>
          <span>${item.label}</span>
        </div>
      `).join('');
    },

    renderLabDirtyState() {
      const modelCount = this.state.lab.dirtyPaths.size;
      const visualCount = this.state.lab.visualDirtyPaths.size;
      const totalCount = modelCount + visualCount;

      this.els.dirtyBadge.classList.toggle('hidden', totalCount === 0);
      this.els.dirtyBadge.textContent = totalCount > 0 ? `변경 ${totalCount}건` : '적용 완료';

      if (this.els.livePendingCount) {
        this.els.livePendingCount.textContent = `${visualCount}건`;
        this.els.livePendingCount.classList.toggle('ready', visualCount > 0);
      }
      if (this.els.modelPendingCount) {
        this.els.modelPendingCount.textContent = `${modelCount}건`;
        this.els.modelPendingCount.classList.toggle('ready', modelCount > 0);
      }
      if (this.els.pendingCountLabel) {
        this.els.pendingCountLabel.textContent = totalCount > 0
          ? `즉시 반영 ${visualCount}건 · 변경 후 적용 ${modelCount}건`
          : '현재 적용값과 동일';
      }

      if (this.els.pendingChangedFields) {
        const visualTags = Array.from(this.state.lab.visualDirtyPaths).map((path) => {
          const binding = LAB_BINDINGS.find((item) => item.path === path);
          return binding ? binding.label : path;
        });
        const modelTags = Array.from(this.state.lab.dirtyPaths).map((path) => {
          const binding = LAB_BINDINGS.find((item) => item.path === path);
          return binding ? binding.label : path;
        });
        const groups = [];
        if (visualTags.length) {
          groups.push(`
            <div class="tag-group-block">
              <div class="tag-group-title">즉시 반영</div>
              <div class="tag-cloud">${visualTags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
            </div>
          `);
        }
        if (modelTags.length) {
          groups.push(`
            <div class="tag-group-block">
              <div class="tag-group-title">변경 후 적용</div>
              <div class="tag-cloud">${modelTags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
            </div>
          `);
        }
        this.els.pendingChangedFields.innerHTML = groups.length
          ? groups.join('')
          : '<span class="tag">현재 적용된 값과 동일합니다.</span>';
      }

      this.setSectionApplyButton(this.els.applySensorsBtn, this.getDirtyPathsForSection('sensors').length > 0);
      this.setSectionApplyButton(this.els.applyWormBtn, this.getDirtyPathsForSection('worm').length > 0);
      this.setSectionApplyButton(this.els.applyBehaviorBtn, this.getDirtyPathsForSection('behavior').length > 0);
      this.setSectionApplyButton(this.els.applyEnvironmentBtn, this.getDirtyPathsForSection('environment').length > 0);
      this.setSectionApplyButton(this.els.applySeedBtn, this.getDirtyPathsForSection('seed').length > 0);
      this.setSectionApplyButton(this.els.applyVisualsBtn, this.getDirtyPathsForSection('visuals').length > 0, {
        immediate: true,
        feedback: this.state.lab.visualFeedbackUntil > performance.now()
      });
    },

    renderCompareDirtyState() {
      const dirtyCount = this.state.compare.dirtyPaths.size;
      this.els.compareDirtyBadge.classList.toggle('hidden', dirtyCount === 0);
      this.els.compareDirtyBadge.textContent = dirtyCount > 0 ? `B 변경 대기 ${dirtyCount}` : '동기화됨';
      this.els.compareApplyBtn.disabled = dirtyCount === 0;
      this.els.compareApplyBtn.classList.toggle('ready', dirtyCount > 0);
      this.els.compareApplyBtn.classList.toggle('applied', dirtyCount === 0);
      this.els.compareApplyBtn.textContent = dirtyCount > 0 ? 'Variant 적용' : '적용 완료';

      const changed = COMPARE_BINDINGS.filter((binding) => {
        const a = getByPath(this.state.compare.baselineConfig, binding.path);
        const b = getByPath(this.state.compare.variantDraft, binding.path);
        return a !== b;
      }).map((binding) => binding.label);
      this.els.compareChangedFields.innerHTML = changed.length
        ? changed.map((item) => `<span class="tag">${item}</span>`).join('')
        : '<span class="tag">현재 Baseline과 동일합니다.</span>';
    },

    renderPresetLibrary() {
      this.els.presetGrid.innerHTML = PRESETS.map((preset) => `
        <article class="preset-card">
          <div>
            <div class="eyebrow">Preset</div>
            <h3>${preset.name}</h3>
          </div>
          <p>${preset.description}</p>
          <div class="tag-cloud">
            ${preset.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
          </div>
          <div class="preset-footer">
            <button class="primary-btn small" data-preset-load="${preset.id}">이 프리셋으로 시작</button>
          </div>
        </article>
      `).join('');
      this.els.presetGrid.querySelectorAll('[data-preset-load]').forEach((button) => {
        button.addEventListener('click', () => {
          const preset = PRESETS.find((item) => item.id === button.dataset.presetLoad);
          if (!preset) return;
          const config = mergeDeep(DEFAULT_CONFIG, preset.overrides);
          config.presetName = preset.name;
          this.state.lab.appliedConfig = deepClone(config);
          this.state.lab.draftConfig = deepClone(config);
          this.state.lab.dirtyPaths.clear();
          this.state.lab.visualDirtyPaths.clear();
          const nextSeed = randomSeed();
          this.state.lab.appliedSeed = nextSeed;
          this.state.lab.draftSeed = nextSeed;
          this.syncLabControlsFromState();
          this.createLabSimulation();
          this.switchView('lab');
          this.hideLandingOverlay();
          this.toast(`${preset.name} preset을 적용했습니다.`);
        });
      });
    },

    renderSavedRuns() {
      if (!this.state.savedRuns.length) {
        this.els.savedGrid.innerHTML = '<article class="preset-card"><h3>저장된 run이 없습니다.</h3><p>Lab에서 Save Config를 누르면 이곳에 저장됩니다.</p></article>';
        return;
      }
      this.els.savedGrid.innerHTML = this.state.savedRuns.map((entry) => `
        <article class="preset-card">
          <div>
            <div class="eyebrow">Saved</div>
            <h3>${entry.name}</h3>
          </div>
          <p>Seed: <strong>${entry.seed}</strong></p>
          <div class="tag-cloud">
            <span class="tag">Distance ${formatNumber(entry.metrics?.distance || 0, 1)}</span>
            <span class="tag">Food ${timeLabel(entry.metrics?.foodTime || 0)}</span>
            <span class="tag">Collisions ${entry.metrics?.collisions ?? 0}</span>
          </div>
          <div class="preset-footer">
            <button class="secondary-btn small" data-saved-load="${entry.id}">Lab에 불러오기</button>
            <button class="ghost-btn small" data-saved-delete="${entry.id}">삭제</button>
          </div>
        </article>
      `).join('');

      this.els.savedGrid.querySelectorAll('[data-saved-load]').forEach((button) => {
        button.addEventListener('click', () => {
          const entry = this.state.savedRuns.find((item) => item.id === button.dataset.savedLoad);
          if (!entry) return;
          this.state.lab.appliedConfig = deepClone(entry.config);
          this.state.lab.draftConfig = deepClone(entry.config);
          this.state.lab.appliedSeed = entry.seed;
          this.state.lab.draftSeed = entry.seed;
          this.state.lab.dirtyPaths.clear();
          this.state.lab.visualDirtyPaths.clear();
          this.syncLabControlsFromState();
          this.createLabSimulation();
          this.switchView('lab');
          this.toast('저장된 config를 Lab으로 불러왔습니다.');
        });
      });

      this.els.savedGrid.querySelectorAll('[data-saved-delete]').forEach((button) => {
        button.addEventListener('click', () => {
          this.state.savedRuns = this.state.savedRuns.filter((item) => item.id !== button.dataset.savedDelete);
          localStorage.setItem(STORAGE_KEYS.saves, JSON.stringify(this.state.savedRuns));
          this.renderSavedRuns();
        });
      });
    },

    renderCurrentExplanation(snapshot, stateName) {
      const config = this.state.lab.appliedConfig;
      const chemoDelta = snapshot.sensor.chemoRight - snapshot.sensor.chemoLeft;
      const headline = stateName === 'Cruise'
        ? '기본 전진 상태를 유지하는 중입니다.'
        : stateName === 'Reverse'
          ? '후진으로 공간을 다시 확보하는 중입니다.'
          : '방향을 크게 바꾸며 재배향하는 중입니다.';

      const touchMessage = snapshot.sensor.touchFront
        ? '정면 접촉이 감지되어 회피 동작이 최우선입니다.'
        : snapshot.sensor.touchLeft
          ? '왼쪽 접촉이 감지되어 오른쪽으로 비틀리는 바이어스가 생깁니다.'
          : snapshot.sensor.touchRight
            ? '오른쪽 접촉이 감지되어 왼쪽으로 비틀리는 바이어스가 생깁니다.'
            : '촉각 충돌은 없어서 전진 또는 기울기 추종이 우선입니다.';

      const chemoMessage = !config.sensors.chemo
        ? '화학 감각은 현재 꺼져 있습니다.'
        : Math.abs(chemoDelta) < 0.03
          ? '좌우 화학 농도 차이가 작아 방향 편향은 약합니다.'
          : chemoDelta > 0
            ? '오른쪽 화학 농도가 더 높아 우측 편향이 생깁니다.'
            : '왼쪽 화학 농도가 더 높아 좌측 편향이 생깁니다.';

      const thermoMessage = !config.sensors.thermo || config.world.temperatureMode === 'none'
        ? '온도 구배는 현재 움직임을 거의 바꾸지 않습니다.'
        : snapshot.sensor.tempError > config.behavior.discomfort
          ? '선호 온도에서 벗어나 회전 확률이 올라간 상태입니다.'
          : '현재 온도는 선호 범위와 비교적 가깝습니다.';

      const modelPending = this.state.lab.dirtyPaths.size;
      const visualPending = this.state.lab.visualDirtyPaths.size;
      const pendingNote = modelPending || visualPending
        ? `현재 적용 전 변경은 즉시 반영 ${visualPending}건, 변경 후 적용 ${modelPending}건입니다. 각 섹션의 변경사항 적용 버튼으로 반영하세요.`
        : '현재 보이는 결과와 적용된 파라미터가 일치합니다.';

      this.els.currentExplanation.innerHTML = `
        <div class="explanation-title">${headline}</div>
        <div class="explanation-copy">${touchMessage}</div>
        <div class="explanation-copy">${chemoMessage}</div>
        <div class="explanation-copy">${thermoMessage}</div>
        <div class="explanation-copy">${pendingNote}</div>
      `;
    },

    renderLabMonitor() {
      const sim = this.state.lab.sim;
      if (!sim) return;
      const snapshot = sim.getSnapshot();
      const metrics = snapshot.metrics;
      const headingDegrees = ((snapshot.heading * 180) / Math.PI + 360) % 360;
      const stateName = snapshot.state === 'cruise' ? 'Cruise' : snapshot.state === 'reverse' ? 'Reverse' : 'Turn';
      this.els.monitorStatePill.textContent = stateName;
      this.els.monitorStatePill.className = `mini-pill ${snapshot.state === 'cruise' ? 'neutral' : ''}`;

      this.renderCurrentExplanation(snapshot, stateName);

      this.els.stateSummaryGrid.innerHTML = [
        { label: 'Behavior', value: stateName, sub: `${timeLabel(metrics.elapsed)}` },
        { label: 'Position', value: `${snapshot.position.x.toFixed(1)}, ${snapshot.position.y.toFixed(1)}`, sub: 'world' },
        { label: 'Heading', value: `${headingDegrees.toFixed(0)}°`, sub: 'orientation' },
        { label: 'Speed', value: `${snapshot.speed.toFixed(1)} u/s`, sub: 'current' },
        { label: 'Distance', value: `${metrics.distance.toFixed(1)}`, sub: 'travelled' },
        { label: 'Food time', value: `${metrics.foodTime.toFixed(1)} s`, sub: metrics.firstFoodTime == null ? 'not reached yet' : `first ${metrics.firstFoodTime.toFixed(1)} s` }
      ].map((item) => `
        <div class="summary-card">
          <div class="label">${item.label}</div>
          <div class="value">${item.value}</div>
          <div class="subvalue">${item.sub}</div>
        </div>
      `).join('');

      this.els.sensorSummaryGrid.innerHTML = [
        { label: 'Touch', value: snapshot.sensor.touchFront ? 'Front' : (snapshot.sensor.touchLeft || snapshot.sensor.touchRight ? 'Side' : 'None'), sub: 'contact' },
        { label: 'Chemo L', value: formatNumber(snapshot.sensor.chemoLeft, 2), sub: 'left' },
        { label: 'Chemo R', value: formatNumber(snapshot.sensor.chemoRight, 2), sub: 'right' },
        { label: 'Chemo Δ', value: formatSigned(snapshot.sensor.chemoRight - snapshot.sensor.chemoLeft, 2), sub: 'R - L' },
        { label: 'Temp', value: formatNumber(snapshot.sensor.tempCurrent, 2), sub: 'field' },
        { label: 'Temp error', value: formatNumber(snapshot.sensor.tempError, 2), sub: 'to pref.' }
      ].map((item) => `
        <div class="summary-card">
          <div class="label">${item.label}</div>
          <div class="value">${item.value}</div>
          <div class="subvalue">${item.sub}</div>
        </div>
      `).join('');

      const eventKindLabels = {
        start: 'RUN',
        reverse: 'REV',
        turn: 'TURN',
        food: 'FOOD',
        'food-exit': 'OUT',
        collision: 'TOUCH',
        resume: 'MOVE'
      };
      const eventBriefLabels = {
        start: '초기화',
        reverse: '후진',
        turn: '회전',
        food: '먹이 진입',
        'food-exit': '먹이 이탈',
        collision: '접촉 감지',
        resume: '전진 복귀'
      };
      this.els.recentEventsList.innerHTML = snapshot.events.length
        ? snapshot.events.slice(0, 5).map((event) => `
            <div class="event-item">
              <div class="event-time">${timeLabel(event.time)}</div>
              <div class="event-kind">${eventKindLabels[event.type] || 'LOG'}</div>
              <div class="event-item-brief" title="${event.title}">${eventBriefLabels[event.type] || event.title}</div>
            </div>
          `).join('')
        : '<div class="event-item"><div class="event-time">—</div><div class="event-kind">LOG</div><div class="event-item-brief">아직 이벤트가 없습니다.</div></div>';

      this.els.labMetricStrip.innerHTML = [
        `State ${stateName}`,
        `Distance ${metrics.distance.toFixed(1)}`,
        `Food ${metrics.foodTime.toFixed(1)} s`,
        `Collisions ${metrics.collisions}`,
        `Turns ${metrics.turns}`,
        `Reversals ${metrics.reversals}`
      ].map((item) => `<span class="metric-chip">${item}</span>`).join('');
    },

    renderCompareMetrics() {
      const simA = this.state.compare.simA;
      const simB = this.state.compare.simB;
      if (!simA || !simB) return;
      const metricsA = simA.getMetrics();
      const metricsB = simB.getMetrics();
      this.els.compareMetricsA.innerHTML = [
        `Distance ${metricsA.distance.toFixed(1)}`,
        `Food ${metricsA.foodTime.toFixed(1)} s`,
        `Collisions ${metricsA.collisions}`,
        `Turns ${metricsA.turns}`
      ].map((item) => `<span class="metric-chip">${item}</span>`).join('');
      this.els.compareMetricsB.innerHTML = [
        `Distance ${metricsB.distance.toFixed(1)}`,
        `Food ${metricsB.foodTime.toFixed(1)} s`,
        `Collisions ${metricsB.collisions}`,
        `Turns ${metricsB.turns}`
      ].map((item) => `<span class="metric-chip">${item}</span>`).join('');

      const deltaItems = [
        { label: 'Distance Δ', value: metricsB.distance - metricsA.distance, digits: 1 },
        { label: 'Food time Δ', value: metricsB.foodTime - metricsA.foodTime, digits: 1 },
        { label: 'Collisions Δ', value: metricsB.collisions - metricsA.collisions, digits: 0 },
        { label: 'Turns Δ', value: metricsB.turns - metricsA.turns, digits: 0 },
        { label: 'Avg chemo Δ', value: metricsB.avgChemo - metricsA.avgChemo, digits: 2 },
        { label: 'Temp error Δ', value: metricsB.avgTempError - metricsA.avgTempError, digits: 2 }
      ];
      this.els.deltaMetrics.innerHTML = deltaItems.map((item) => {
        const value = Number(item.value);
        const cls = value > 0 ? 'positive' : (value < 0 ? 'negative' : '');
        return `
          <div class="delta-card ${cls}">
            <div class="label">${item.label}</div>
            <div class="value">${formatSigned(value, item.digits)}</div>
          </div>
        `;
      }).join('');
    },

    renderCompareLayout() {
      this.els.compareLayoutRoot.classList.toggle('compare-layout-2x1', this.state.compare.layout === '2x1');
      this.els.compareLayoutRoot.classList.toggle('compare-layout-2x2', this.state.compare.layout === '2x2');
      this.els.compareLayout2x1Btn.classList.toggle('active', this.state.compare.layout === '2x1');
      this.els.compareLayout2x2Btn.classList.toggle('active', this.state.compare.layout === '2x2');
      this.els.settingCompareDefaultLayout.value = this.state.compare.layout;
    },

    renderTopbarStatus() {
      this.els.labPlayBtn.textContent = this.state.lab.running ? 'Pause' : 'Play';
      this.els.compareRunBtn.textContent = this.state.compare.running ? 'Pause Both' : 'Run Both';
    },

    renderAll() {
      this.syncLabControlsFromState();
      this.syncCompareControlsFromState();
      this.renderLabMonitor();
      this.renderCompareMetrics();
      this.renderCompareLayout();
      this.renderTopbarStatus();
    },

    startLoop() {
      let lastTimestamp = performance.now();
      const frame = (timestamp) => {
        const deltaMs = Math.min(50, timestamp - lastTimestamp);
        lastTimestamp = timestamp;
        const deltaSeconds = deltaMs / 1000;

        if (this.state.lab.sim) {
          this.state.lab.sim.tickVisualCues(deltaSeconds);
          if (this.state.lab.running) {
            this.state.lab.sim.accumulator += deltaSeconds * this.state.lab.timeScale;
            while (this.state.lab.sim.accumulator >= this.state.lab.sim.fixedStep) {
              this.state.lab.sim.step(this.state.lab.sim.fixedStep);
              this.state.lab.sim.accumulator -= this.state.lab.sim.fixedStep;
            }
          }
          if (this.state.lab.running || this.state.lab.sim.hasActiveCues()) {
            this.state.lab.sim.render();
          }
        }

        if (this.state.compare.simA && this.state.compare.simB) {
          [this.state.compare.simA, this.state.compare.simB].forEach((sim) => {
            sim.tickVisualCues(deltaSeconds);
            if (this.state.compare.running) {
              sim.accumulator += deltaSeconds * this.state.compare.timeScale;
              while (sim.accumulator >= sim.fixedStep) {
                sim.step(sim.fixedStep);
                sim.accumulator -= sim.fixedStep;
              }
            }
            if (this.state.compare.running || sim.hasActiveCues()) {
              sim.render();
            }
          });
        }

        this.renderLabMonitor();
        this.renderLabDirtyState();
        this.renderCompareMetrics();
        this.renderTopbarStatus();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },

    exportCompareCanvas() {
      const canvasA = this.els.compareCanvasA;
      const canvasB = this.els.compareCanvasB;
      if (!canvasA || !canvasB) return;
      syncCanvasForHiDPI(canvasA);
      syncCanvasForHiDPI(canvasB);
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvasA.width + canvasB.width + 32;
      exportCanvas.height = Math.max(canvasA.height, canvasB.height) + 96;
      const ctx = exportCanvas.getContext('2d');
      ctx.fillStyle = '#0d1118';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ctx.fillStyle = '#eef3ff';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillText('Nema Lab Compare', 24, 42);
      ctx.drawImage(canvasA, 16, 64);
      ctx.drawImage(canvasB, canvasA.width + 24, 64);
      const a = document.createElement('a');
      a.href = exportCanvas.toDataURL('image/png');
      a.download = 'nema-lab-compare.png';
      a.click();
    }
  };

  window.addEventListener('DOMContentLoaded', () => app.init());
})();
