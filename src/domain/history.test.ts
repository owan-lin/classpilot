import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { commitHistory, createHistory, redoHistory, undoHistory } from './history'

describe('immutable history properties', () => {
  it('undo followed by redo restores the committed value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (initial, next) => {
        const committed = commitHistory(createHistory(initial), next)
        expect(redoHistory(undoHistory(committed)).present).toEqual(next)
      }),
    )
  })

  it('stores an immutable copy rather than the caller-owned object', () => {
    const value = { assignments: [{ seatId: 'a', studentId: 's' }] }
    const history = createHistory(value)
    value.assignments[0].seatId = 'changed'
    expect(history.present.assignments[0].seatId).toBe('a')
    expect(Object.isFrozen(history.present.assignments)).toBe(true)
  })
})
