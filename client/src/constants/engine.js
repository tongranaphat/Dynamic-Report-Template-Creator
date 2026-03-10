/**
 * Engine Feature Flag
 *
 * Controls which canvas rendering engine is active.
 * Default: legacy (false).
 * Activate new engine via URL: ?engine=new
 */
export const USE_NEW_ENGINE =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('engine') === 'new'
