import type { AlertKind, MonitorOverall, MonitorState } from './types'

export const PERSISTENT_FAIL_REPEAT_MS = 24 * 60 * 60 * 1000

export function emptyMonitorState(tenantId: string): MonitorState {
  return { tenantId, lastOverall: null, lastOkAt: null, lastAlertAt: null, lastAlertKind: null, alertOpen: false, consecutiveFailures: 0, lastManualAt: null }
}

/**
 * Alert state machine.
 * - `fail` raises one alert, repeats at most every 24 h while it persists.
 * - `warn` never alerts and never closes an open fail (ok → fail → warn → ok sends exactly: fail, recovery).
 * - `ok` sends recovery only if a fail alert is open.
 * - `skipped` changes nothing.
 */
export function advanceMonitorState(previous: MonitorState, overall: MonitorOverall, now: Date): { state: MonitorState; alert: AlertKind | null } {
  if (overall === 'skipped') return { state: previous, alert: null }
  const nowIso = now.toISOString()
  const state: MonitorState = { ...previous, lastOverall: overall }
  let alert: AlertKind | null = null

  if (overall === 'fail') {
    state.consecutiveFailures = previous.consecutiveFailures + 1
    if (!previous.alertOpen) {
      alert = 'fail'
      state.alertOpen = true
    } else if (!previous.lastAlertAt || now.getTime() - new Date(previous.lastAlertAt).getTime() >= PERSISTENT_FAIL_REPEAT_MS) {
      alert = 'persistent_fail'
    }
  } else if (overall === 'ok') {
    state.consecutiveFailures = 0
    state.lastOkAt = nowIso
    if (previous.alertOpen) {
      alert = 'recovery'
      state.alertOpen = false
    }
  }

  if (alert) {
    state.lastAlertAt = nowIso
    state.lastAlertKind = alert
  }
  return { state, alert }
}
