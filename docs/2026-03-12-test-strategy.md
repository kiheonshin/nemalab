# Nema Lab React Rebuild -- Test Strategy

**Date:** 2026-03-12
**Author:** QA Engineer (V1)
**Project:** Nema Lab Simulation (React 18 + TypeScript strict + Vite 6)

---

## 1. Test Pyramid

```
          /  E2E  \           ~5%   (Playwright, future)
         /----------\
        / Integration \       ~25%  (Zustand stores, hooks, component interactions)
       /----------------\
      /      Unit        \    ~70%  (Engine logic, math, RNG, utilities)
     /--------------------\
```

### Ratio Breakdown

| Layer       | Target % | Tooling                          | Scope                                              |
|-------------|----------|----------------------------------|------------------------------------------------------|
| Unit        | 70%      | Vitest                           | Engine (pure TS): math, rng, BehaviorSystem, SensorSystem, ExplanationEngine, WorldGenerator, WormSimulation |
| Integration | 25%      | Vitest + @testing-library/react  | Zustand store slices, React hooks (useSimulation, useExplanation), component composition, i18n key resolution |
| E2E         | 5%       | Playwright (future phase)        | Full user flows: preset selection, simulation run, save/load, language toggle |

### Justification

- **Engine-heavy pyramid:** The simulation engine contains the core scientific logic (state machine, sensor sampling, collision detection, RNG determinism). Bugs here directly affect simulation correctness, which is the product's primary value proposition.
- **Integration is secondary:** Zustand stores are thin pass-through layers. Most component logic delegates to the engine. Testing at this layer validates wiring, not computation.
- **E2E deferred:** The application is a single-page educational tool. Critical user flows are few and stable. E2E tests will be added once the UI stabilizes in the next verification phase.

---

## 2. Coverage Targets

| Metric                    | Current   | Target (V1) | Target (V2) |
|---------------------------|-----------|--------------|--------------|
| Engine unit line coverage | ~45%      | **80%**      | 90%          |
| Engine branch coverage    | ~30%      | **70%**      | 85%          |
| Store integration         | 0%        | **50%**      | 75%          |
| Component render tests    | 0%        | **30%**      | 60%          |
| Overall project coverage  | ~15%      | **50%**      | 70%          |

### Measurement

```bash
npx vitest run --coverage
```

Coverage is tracked via `@vitest/coverage-v8` (or `c8`). Thresholds can be enforced in `vite.config.ts`:

```ts
test: {
  coverage: {
    provider: 'v8',
    thresholds: {
      'src/engine/**': { lines: 80, branches: 70 },
    },
  },
}
```

---

## 3. Core Test Areas

### 3.1 Engine Unit Tests (Priority: Critical)

| Module              | File                          | Key Test Areas                                                               | Tests Added |
|---------------------|-------------------------------|------------------------------------------------------------------------------|-------------|
| Math utilities      | math.test.ts                  | clamp, lerp, formatNumber, deepClone, mergeDeep, getByPath, setByPath        | 20 (existing) |
| RNG                 | rng.test.ts                   | hashString determinism, mulberry32 uniformity, randomSeed format              | 8 (existing)  |
| WormSimulation      | WormSimulation.test.ts        | Init, determinism, metrics, snapshot, reset, config, bounds                   | 9 (existing)  |
| SensorSystem        | SensorSystem.test.ts          | computeSamplePoints geometry, sampleFood Gaussian, sampleTemperature modes, detectCollision walls/obstacles | **28 (new)** |
| BehaviorSystem      | BehaviorSystem.test.ts        | State transitions (cruise/reverse/turn cycle), bias computation, collision response, updateBody, determinism | **30 (new)** |
| ExplanationEngine   | ExplanationEngine.test.ts     | State key matching, chemo/thermo/touch explanations, bias, disabled sensors, events | **27 (new)** |
| WorldGenerator      | WorldGenerator.test.ts        | Deterministic generation, seed variation, obstacle placement rules, food/hotspot positioning | **20 (new)** |

**Total: 37 existing + ~105 new = ~142 tests**

### 3.2 Integration Tests (Priority: High, Phase V2)

| Area                    | Scope                                                    |
|-------------------------|----------------------------------------------------------|
| Zustand simulationSlice | Config changes propagate to engine; play/pause/reset     |
| Zustand storageSlice    | Save/load round-trip with IndexedDB mock                 |
| useSimulation hook      | requestAnimationFrame loop starts/stops; snapshot updates |
| useExplanation hook     | Returns correct i18n keys for each state                 |
| Preset loading          | Selecting a preset applies correct config overrides       |

### 3.3 Component Render Tests (Priority: Medium, Phase V2)

| Component          | What to Verify                                       |
|--------------------|------------------------------------------------------|
| ControlPanel       | Slider values map to config; preset buttons work     |
| MetricsPanel       | Displays formatted metrics from snapshot             |
| ExplanationOverlay | Renders correct i18n text for each explanation key   |
| EventLog           | Shows recent events in correct order                 |
| SimulationView     | Canvas ref created; start/stop buttons functional    |

### 3.4 E2E Tests (Priority: Low, Phase V3)

| Flow                 | Steps                                              |
|----------------------|------------------------------------------------------|
| Default simulation   | Open -> auto-play -> verify worm moves on canvas     |
| Preset switch        | Select "Touch Only" -> verify config changes applied |
| Save and Load        | Run 10s -> save -> reload -> verify state restored   |
| Language toggle      | Switch ko->en -> verify all UI text changes          |

---

## 4. Test Quality Standards

### 4.1 Determinism

All engine tests must be deterministic. Tests that use RNG must:
- Provide a fixed seed
- Assert exact numeric values (not just `> 0`)
- Verify reproducibility by running the same logic twice

### 4.2 Edge Cases

Each test module must cover:
- **Boundary values:** wall margins, zero density, max/min config ranges
- **State transitions:** every valid transition in the state machine
- **Sensor modes:** all three temperature modes (none, linear, radial)
- **Disabled features:** behavior when sensors are toggled off

### 4.3 No Browser Dependencies

Engine tests must remain pure TypeScript with zero DOM/Canvas/browser API dependencies. This ensures:
- Fast execution (no jsdom overhead)
- CI compatibility
- Clear separation of concerns

### 4.4 Test Isolation

Each test must be independent. No shared mutable state between tests. Helper functions create fresh instances for each test case.

---

## 5. CI Integration (Recommended)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx vitest run --coverage
      - run: npx tsc --noEmit
```

---

## 6. Risk Assessment

| Risk                                  | Mitigation                                                   |
|---------------------------------------|--------------------------------------------------------------|
| RNG divergence across platforms       | Pin exact numeric assertions; test on CI                     |
| Canvas rendering untestable in jsdom  | Defer to E2E; test only data layer                           |
| IndexedDB mocking complexity          | Use `fake-indexeddb` or test at store slice level            |
| Flaky timing-dependent behavior tests | Use fixed dt (1/60), deterministic RNG, no real timers       |
| Coverage gaps in state machine        | Full cycle test (cruise->reverse->turn->cruise) ensures all paths |

---

## 7. Execution Plan

| Phase | Timing     | Deliverable                                    | Tests |
|-------|------------|------------------------------------------------|-------|
| V1    | 2026-03-12 | Engine unit tests (SensorSystem, BehaviorSystem, ExplanationEngine, WorldGenerator) | ~105 new |
| V2    | 2026-03-15 | Zustand store + hook integration tests         | ~30   |
| V3    | 2026-03-20 | Component render tests + E2E setup             | ~25   |
| V4    | 2026-03-25 | Coverage enforcement in CI + final report       | --    |
