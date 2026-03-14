// ============================================================================
// Slider Component — Labeled range input with value display
// ============================================================================

import styles from './Slider.module.css';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Format value for display (defaults to .toString()) */
  format?: (value: number) => string;
  disabled?: boolean;
  dirty?: boolean;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled = false,
  dirty = false,
}: SliderProps) {
  const displayValue = format ? format(value) : String(value);

  return (
    <label className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <strong className={`${styles.value} ${dirty ? styles.dirty : ''}`}>
          {displayValue}
        </strong>
      </div>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </label>
  );
}
