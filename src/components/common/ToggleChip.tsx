// ============================================================================
// ToggleChip Component — Sensor toggle with indicator dot
// ============================================================================

import styles from './ToggleChip.module.css';

export interface ToggleChipProps {
  label: string;
  checked: boolean;
  previewing?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleChip({
  label,
  checked,
  previewing = false,
  onChange,
  disabled = false,
}: ToggleChipProps) {
  const classes = [
    styles.chip,
    checked ? styles.on : '',
    previewing ? styles.previewing : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
    >
      <span className={styles.indicator} />
      {label}
    </button>
  );
}
