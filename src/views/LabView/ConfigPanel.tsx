// ============================================================================
// ConfigPanel — Left rail config sections with per-section apply
// ============================================================================

import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store';
import { Toggle } from '../../components/common/Toggle';
import { Slider } from '../../components/common/Slider';
import { Button } from '../../components/common/Button';
import { trackEvent, EVENTS } from '../../analytics';
import styles from './ConfigPanel.module.css';

type SectionKey = 'sensors' | 'worm' | 'behavior' | 'environment' | 'visuals';

function useSectionDirty(section: SectionKey): boolean {
  const dirtyPaths = useStore((s) => s.dirtyPaths);
  const prefixMap: Record<SectionKey, string> = {
    sensors: 'sensors.',
    worm: 'worm.',
    behavior: 'behavior.',
    environment: 'world.',
    visuals: 'visuals.',
  };
  const prefix = prefixMap[section];
  for (const path of dirtyPaths) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export function ConfigPanel() {
  const { t } = useTranslation();
  const draftConfig = useStore((s) => s.draftConfig);
  const dirtyPaths = useStore((s) => s.dirtyPaths);
  const setDraftValue = useStore((s) => s.setDraftValue);
  const applySection = useStore((s) => s.applySection);
  const showToast = useStore((s) => s.showToast);

  const handleApplySection = (section: SectionKey) => {
    trackEvent(EVENTS.PARAM_CHANGE, { section });
    applySection(section);
    showToast(t('toast.configApplied'));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.scrollArea}>
        {/* --- Sensors Section --- */}
        <SectionBlock
          section="sensors"
          title={t('lab.sensors')}
          onApply={() => handleApplySection('sensors')}
        >
          <div className={styles.toggleRow}>
            <Toggle
              label={t('sensors.touch')}
              checked={draftConfig.sensors.touch}
              onChange={(v) => setDraftValue('sensors.touch', v)}
              tooltip={t('tooltip.touch')}
            />
            <Toggle
              label={t('sensors.chemo')}
              checked={draftConfig.sensors.chemo}
              onChange={(v) => setDraftValue('sensors.chemo', v)}
              tooltip={t('tooltip.chemo')}
            />
            <Toggle
              label={t('sensors.thermo')}
              checked={draftConfig.sensors.thermo}
              onChange={(v) => setDraftValue('sensors.thermo', v)}
              tooltip={t('tooltip.thermo')}
            />
          </div>
          <Slider
            label={t('params.sampleDistance')}
            value={draftConfig.sensors.sampleDistance}
            min={2} max={12} step={0.5}
            onChange={(v) => setDraftValue('sensors.sampleDistance', v)}
            dirty={dirtyPaths.has('sensors.sampleDistance')}
          />
          <Slider
            label={t('params.memory')}
            value={draftConfig.sensors.memory}
            min={200} max={2500} step={50}
            onChange={(v) => setDraftValue('sensors.memory', v)}
            dirty={dirtyPaths.has('sensors.memory')}
          />
          <Slider
            label={t('params.noise')}
            value={draftConfig.sensors.noise}
            min={0} max={1} step={0.01}
            onChange={(v) => setDraftValue('sensors.noise', v)}
            dirty={dirtyPaths.has('sensors.noise')}
          />
        </SectionBlock>

        {/* --- Visuals Section --- */}
        <SectionBlock
          section="visuals"
          title={t('lab.visuals')}
          onApply={() => handleApplySection('visuals')}
        >
          <div className={styles.toggleRow}>
            <Toggle
              label={t('params.showTrail')}
              checked={draftConfig.visuals.showTrail}
              onChange={(v) => setDraftValue('visuals.showTrail', v)}
              tooltip={t('tooltip.showTrail')}
            />
            <Toggle
              label={t('params.showChemicalOverlay')}
              checked={draftConfig.visuals.showChemicalOverlay}
              onChange={(v) => setDraftValue('visuals.showChemicalOverlay', v)}
              tooltip={t('tooltip.showChemicalOverlay')}
            />
            <Toggle
              label={t('params.showTemperatureOverlay')}
              checked={draftConfig.visuals.showTemperatureOverlay}
              onChange={(v) =>
                setDraftValue('visuals.showTemperatureOverlay', v)
              }
              tooltip={t('tooltip.showTemperatureOverlay')}
            />
            <Toggle
              label={t('params.showSensors')}
              checked={draftConfig.visuals.showSensors}
              onChange={(v) => setDraftValue('visuals.showSensors', v)}
              tooltip={t('tooltip.showSensors')}
            />
            <Toggle
              label={t('params.showEventMarkers')}
              checked={draftConfig.visuals.showEventMarkers}
              onChange={(v) => setDraftValue('visuals.showEventMarkers', v)}
              tooltip={t('tooltip.showEventMarkers')}
            />
            <Toggle
              label={t('params.cleanMode')}
              checked={draftConfig.visuals.cleanMode}
              onChange={(v) => setDraftValue('visuals.cleanMode', v)}
              tooltip={t('tooltip.cleanMode')}
            />
          </div>
          <Slider
            label={t('params.trailLength')}
            value={draftConfig.visuals.trailLength}
            min={60} max={720} step={10}
            onChange={(v) => setDraftValue('visuals.trailLength', v)}
            dirty={dirtyPaths.has('visuals.trailLength')}
          />
          <Slider
            label={t('params.overlayOpacity')}
            value={draftConfig.visuals.overlayOpacity}
            min={0} max={1} step={0.05}
            onChange={(v) => setDraftValue('visuals.overlayOpacity', v)}
            dirty={dirtyPaths.has('visuals.overlayOpacity')}
          />
        </SectionBlock>

        {/* --- Worm Section --- */}
        <SectionBlock
          section="worm"
          title={t('lab.worm')}
          onApply={() => handleApplySection('worm')}
        >
          <Slider
            label={t('params.baseSpeed')}
            value={draftConfig.worm.baseSpeed}
            min={6} max={30} step={0.5}
            onChange={(v) => setDraftValue('worm.baseSpeed', v)}
            dirty={dirtyPaths.has('worm.baseSpeed')}
          />
          <Slider
            label={t('params.turnSharpness')}
            value={draftConfig.worm.turnSharpness}
            min={0.5} max={5} step={0.05}
            onChange={(v) => setDraftValue('worm.turnSharpness', v)}
            dirty={dirtyPaths.has('worm.turnSharpness')}
          />
          <Slider
            label={t('params.reversalDuration')}
            value={draftConfig.worm.reversalDuration}
            min={200} max={1800} step={50}
            onChange={(v) => setDraftValue('worm.reversalDuration', v)}
            dirty={dirtyPaths.has('worm.reversalDuration')}
          />
          <Slider
            label={t('params.segmentCount')}
            value={draftConfig.worm.segmentCount}
            min={10} max={32} step={1}
            onChange={(v) => setDraftValue('worm.segmentCount', v)}
            dirty={dirtyPaths.has('worm.segmentCount')}
          />
        </SectionBlock>

        {/* --- Behavior Section --- */}
        <SectionBlock
          section="behavior"
          title={t('lab.behavior')}
          onApply={() => handleApplySection('behavior')}
        >
          <Slider
            label={t('params.turnProbability')}
            value={draftConfig.behavior.turnProbability}
            min={0} max={0.35} step={0.005}
            onChange={(v) => setDraftValue('behavior.turnProbability', v)}
            dirty={dirtyPaths.has('behavior.turnProbability')}
          />
          <Slider
            label={t('params.gradientGain')}
            value={draftConfig.behavior.gradientGain}
            min={0} max={3} step={0.05}
            onChange={(v) => setDraftValue('behavior.gradientGain', v)}
            dirty={dirtyPaths.has('behavior.gradientGain')}
          />
          <Slider
            label={t('params.exploration')}
            value={draftConfig.behavior.exploration}
            min={0} max={1} step={0.01}
            onChange={(v) => setDraftValue('behavior.exploration', v)}
            dirty={dirtyPaths.has('behavior.exploration')}
          />
          <Slider
            label={t('params.discomfort')}
            value={draftConfig.behavior.discomfort}
            min={0} max={1} step={0.01}
            onChange={(v) => setDraftValue('behavior.discomfort', v)}
            dirty={dirtyPaths.has('behavior.discomfort')}
          />
        </SectionBlock>

        {/* --- Environment Section --- */}
        <SectionBlock
          section="environment"
          title={t('lab.environment')}
          onApply={() => handleApplySection('environment')}
        >
          <Slider
            label={t('params.obstacleDensity')}
            value={draftConfig.world.obstacleDensity}
            min={0} max={0.25} step={0.01}
            onChange={(v) => setDraftValue('world.obstacleDensity', v)}
            dirty={dirtyPaths.has('world.obstacleDensity')}
          />
          <Slider
            label={t('params.foodStrength')}
            value={draftConfig.world.foodStrength}
            min={0.2} max={2} step={0.05}
            onChange={(v) => setDraftValue('world.foodStrength', v)}
            dirty={dirtyPaths.has('world.foodStrength')}
          />
          <Slider
            label={t('params.foodRadius')}
            value={draftConfig.world.foodRadius}
            min={6} max={24} step={0.5}
            onChange={(v) => setDraftValue('world.foodRadius', v)}
            dirty={dirtyPaths.has('world.foodRadius')}
          />
          <div className={styles.selectRow}>
            <span className={styles.selectLabel}>{t('params.temperatureMode')}</span>
            <select
              className={styles.select}
              value={draftConfig.world.temperatureMode}
              onChange={(e) =>
                setDraftValue('world.temperatureMode', e.target.value)
              }
            >
              <option value="none">None</option>
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </select>
          </div>
          <Slider
            label={t('params.preferredTemperature')}
            value={draftConfig.world.preferredTemperature}
            min={0} max={1} step={0.01}
            onChange={(v) => setDraftValue('world.preferredTemperature', v)}
            dirty={dirtyPaths.has('world.preferredTemperature')}
          />
        </SectionBlock>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Block sub-component
// ---------------------------------------------------------------------------

interface SectionBlockProps {
  section: SectionKey;
  title: string;
  onApply: () => void;
  children: ReactNode;
}

function SectionBlock({ section, title, onApply, children }: SectionBlockProps) {
  const { t } = useTranslation();
  const dirty = useSectionDirty(section);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        <Button
          variant={dirty ? 'primary' : 'ghost'}
          size="small"
          onClick={onApply}
          disabled={!dirty}
        >
          {t('lab.apply')}
        </Button>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}
