// ============================================================================
// Toggle Chip Component: sensor enable/disable chip with optional tooltip
// ============================================================================

import { createPortal } from 'react-dom';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({
    visibility: 'hidden',
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);

  const classes = [
    styles.chip,
    checked ? styles.on : '',
    previewing ? styles.previewing : '',
  ]
    .filter(Boolean)
    .join(' ');

  const updateTooltipPosition = () => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const anchorRect = wrapperRef.current.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const tooltipGap = 10;
    const spaceAbove = anchorRect.top - viewportPadding;
    const spaceBelow = window.innerHeight - anchorRect.bottom - viewportPadding;
    const placeBelow = spaceBelow >= tipRect.height + tooltipGap || spaceBelow >= spaceAbove;

    const left = Math.min(
      Math.max(anchorRect.left + anchorRect.width / 2 - tipRect.width / 2, viewportPadding),
      window.innerWidth - tipRect.width - viewportPadding,
    );
    const top = placeBelow
      ? Math.min(
          anchorRect.bottom + tooltipGap,
          window.innerHeight - tipRect.height - viewportPadding,
        )
      : Math.max(viewportPadding, anchorRect.top - tipRect.height - tooltipGap);

    setTooltipStyle({
      left,
      top,
      visibility: 'visible',
    });
  };

  const handleEnter = () => {
    if (!tooltip) return;
    timerRef.current = setTimeout(() => setShowTip(true), 400);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTip(false);
  };

  useLayoutEffect(() => {
    if (!showTip) {
      setTooltipStyle({ visibility: 'hidden' });
      return;
    }

    updateTooltipPosition();
  }, [showTip, tooltip]);

  useEffect(() => {
    if (!showTip) return;

    const handleViewportChange = () => updateTooltipPosition();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showTip, tooltip]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span
      ref={wrapperRef}
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
      {tooltip && showTip && typeof document !== 'undefined'
        ? createPortal(
            <span ref={tooltipRef} className={styles.tooltip} style={tooltipStyle} role="tooltip">
              {tooltip}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
