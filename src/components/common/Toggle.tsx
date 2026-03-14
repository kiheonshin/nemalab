// ============================================================================
// Toggle Chip Component — Sensor enable/disable chip with optional tooltip
// ============================================================================

import { useState, useRef } from 'react';
import styles from './ToggleChip.module.css';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  previewing?: boolean;
  disabled?: boolean;
  tooltip?: string;
}

export function Toggle({
  label,
  checked,
  onChange,
  previewing = false,
  disabled = false,
  tooltip,
}: ToggleProps) {
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classes = [
    styles.chip,
    checked ? styles.on : '',
    previewing ? styles.previewing : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleEnter = () => {
    if (!tooltip) return;
    timerRef.current = setTimeout(() => setShowTip(true), 400);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTip(false);
  };

  return (
    <span
      className={styles.chipWrapper}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className={classes}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        aria-label={tooltip ? `${label}: ${tooltip}` : label}
      >
        <span className={styles.indicator} />
        {label}
      </button>
      {tooltip && showTip && (
        <span className={styles.tooltip}>{tooltip}</span>
      )}
    </span>
  );
}
