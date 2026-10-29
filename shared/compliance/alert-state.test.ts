import { describe, expect, it } from 'vitest'
import { advanceMonitorState, emptyMonitorState } from './alert-state'
import type { MonitorOverall } from './types'

const at = (hours: number) => new Date(Date.UTC(2026, 10, 17, hours))

function replay(sequence: Array<[MonitorOverall, number]>) {
  let state = emptyMonitorState('t1')
  return sequence.map(([overall, hour]) => {
    const step = advanceMonitorState(state, overall, at(hour))
    state = step.state
    return step.alert
  })
}

describe('advanceMonitorState', () => {
  it('ok → fail → warn → ok: alert on fail, no recovery on warn, recovery on the final ok', () => {
    expect(replay([['ok', 1], ['fail', 2], ['warn', 3], ['ok', 4]])).toEqual([null, 'fail', null, 'recovery'])
  })
  it('deduplicates a continuous incident, including after 24 hours', () => {
    expect(replay([['fail', 1], ['fail', 2], ['fail', 3]])).toEqual(['fail', null, null])
    const state = { ...emptyMonitorState('t1'), alertOpen: true, lastAlertAt: at(0).toISOString() }
    expect(advanceMonitorState(state, 'fail', new Date(at(0).getTime() + 25 * 3600_000)).alert).toBeNull()
  })
  it('warn alone never alerts and ok without an open alert sends nothing', () => {
    expect(replay([['warn', 1], ['ok', 2]])).toEqual([null, null])
  })
  it('fail → ok → fail alerts again', () => {
    expect(replay([['fail', 1], ['ok', 2], ['fail', 3]])).toEqual(['fail', 'recovery', 'fail'])
  })
  it('skipped leaves state untouched', () => {
    const before = emptyMonitorState('t1')
    expect(advanceMonitorState(before, 'skipped', at(1))).toEqual({ state: before, alert: null })
  })
})
