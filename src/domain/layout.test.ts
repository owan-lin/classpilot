import { describe, expect, it } from 'vitest'
import { alignedDeskPositions, classroomStage, isDeskPositionValid, snapDeskPosition } from './layout'
import type { DeskRecord } from './types'

const desk = (id: string, x: number, y: number, width = 150, height = 82): DeskRecord => ({
  id, classId: 'class', kind: 'regular', capacity: 1, x, y, width, height,
  seatIds: [`seat-${id}`], createdAt: '2026-01-01', updatedAt: '2026-01-01',
})

describe('classroom layout contracts', () => {
  it('snaps free coordinates to the configured grid', () => {
    expect(snapDeskPosition({ x: 63, y: 138 })).toEqual({ x: 75, y: 150 })
  })

  it('rejects out-of-bounds and overlapping positions without changing the draft', () => {
    const desks = [desk('first', 50, 100), desk('second', 300, 100)]
    const draft = { desks }
    expect(isDeskPositionValid(draft, 'first', { x: -1, y: 100 })).toBe(false)
    expect(isDeskPositionValid(draft, 'first', { x: 300, y: 100 })).toBe(false)
    expect(isDeskPositionValid(draft, 'first', { x: classroomStage.width - 149, y: 100 })).toBe(false)
    expect(desks[0]).toMatchObject({ x: 50, y: 100 })
  })

  it('creates collision-free aligned coordinates inside the canvas', () => {
    const desks = Array.from({ length: 6 }, (_, index) => desk(String(index), 0, 0))
    const positions = alignedDeskPositions(desks)
    expect(positions).toHaveLength(6)
    const arranged = desks.map((item, index) => ({ ...item, ...positions![index] }))
    positions?.forEach((position, index) => {
      expect(position.x % classroomStage.grid).toBe(0)
      expect(position.y % classroomStage.grid).toBe(0)
      expect(isDeskPositionValid({ desks: arranged }, desks[index].id, position)).toBe(true)
    })
  })

  it('refuses alignment when there is no room for every desk', () => {
    expect(alignedDeskPositions(Array.from({ length: 30 }, (_, index) => desk(String(index), 0, 0)))).toBeUndefined()
  })
})
