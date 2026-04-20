/**
 * Yields control back to the browser's main thread, allowing the UI to
 * repaint and respond to user input between heavy synchronous operations.
 *
 * Uses `scheduler.yield()` if available (Chrome 115+), otherwise falls
 * back to `setTimeout(0)` wrapped in a Promise.
 *
 * Usage:
 *   for (const page of pages) {
 *     await heavyWork(page);
 *     await yieldToMain();  // browser can repaint here
 *   }
 */
export function yieldToMain() {
  if (typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function') {
    return globalThis.scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
