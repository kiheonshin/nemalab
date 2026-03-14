/**
 * Synchronize the canvas internal resolution to match its CSS size * devicePixelRatio.
 * Prevents blurry rendering on HiDPI / Retina displays.
 */
export function syncCanvasForHiDPI(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
