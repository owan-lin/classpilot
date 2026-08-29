import { describe, expect, it } from 'vitest'
import { alignedDeskPositions, classroomStage, constrainFreeDeskPosition, isDeskPositionValid, isFreeDeskPositionVisible, isRegularGridUsable, rebuildRegularLayout, snapDeskPosition } from './layout'
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

  it('rejects regular grids that would leave desks outside the canvas', () => {
    expect(isRegularGridUsable(2, 3)).toBe(true)
    expect(isRegularGridUsable(10, 3)).toBe(false)
    expect(() => rebuildRegularLayout({ id: 'd', classId: 'class', podium: { x: 0, y: 0, width: 1, height: 1 }, desks: [], assignments: [], createdAt: '', updatedAt: '' }, { rows: 10, desksPerRow: 3, capacity: 2 }, { deskId: () => 'new', seatId: () => 'new-seat' }, '')).toThrow(/画布/)
  })

  it('allows overlapping and podium-area free positions while keeping a grab strip visible', () => {
    expect(isFreeDeskPositionVisible(desk('a', 0, 0), { x: 350, y: 20 })).toBe(true)
    expect(isFreeDeskPositionVisible(desk('a', 0, 0), { x: -200, y: 20 })).toBe(false)
    expect(constrainFreeDeskPosition(desk('a', 0, 0), { x: -999, y: 9999 })).toEqual(expect.objectContaining({ x: -118, y: 618 }))
  })

  it('rebuilds regular desks, retains special seats and conserves their students', () => {
    const special = { ...desk('special', 800, 100), kind: 'special' as const }
    const draft = { id: 'd', classId: 'class', podium: { x: 0, y: 0, width: 1, height: 1 }, desks: [desk('old', 0, 0), special], assignments: [{ seatId: 'seat-old', studentId: 'lost-to-pool' }, { seatId: 'seat-special', studentId: 'kept' }], createdAt: '', updatedAt: '' }
    const rebuilt = rebuildRegularLayout(draft, { rows: 1, desksPerRow: 1, capacity: 2 }, { deskId: () => 'new', seatId: () => 'new-seat' }, '')
    expect(rebuilt.desks).toHaveLength(2)
    expect(rebuilt.desks.find((item) => item.kind === 'special')?.id).toBe('special')
    expect(rebuilt.assignments).toEqual([{ seatId: 'seat-special', studentId: 'kept' }])
  })
})
