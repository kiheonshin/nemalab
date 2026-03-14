import { useRef, useEffect } from 'react';

/**
 * Calls `callback(dt)` every animation frame while `active` is true.
 * `dt` is clamped to 100ms to prevent large jumps after tab-away.
 */
export function useAnimationFrame(
  callback: (dt: number) => void,
  active: boolean,
) {
  const rafRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;

    const loop = (time: number) => {
      if (prevTimeRef.current) {
        const dt = Math.min((time - prevTimeRef.current) / 1000, 0.1);
        callbackRef.current(dt);
      }
      prevTimeRef.current = time;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      prevTimeRef.current = 0;
    };
  }, [active]);
}
