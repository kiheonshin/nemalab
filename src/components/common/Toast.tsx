// ============================================================================
// Toast Container — Auto-dismissing notification messages
// ============================================================================

import { useStore } from '../../store';
import styles from './Toast.module.css';

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
