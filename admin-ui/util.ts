/**
 * Utility functions for the admin-ui.
 */

/**
 * Checks if running in Raccoon development mode.
 * In Raccoon dev mode, routes are prefixed with /app/, otherwise they're at root.
 */
export function isRaccoonDev(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/app/')
}
