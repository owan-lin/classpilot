import { describe, expect, it } from 'vitest'
import { alignedDeskPositions, classroomStage, classroomStageFor, constrainFreeDeskPosition, isDeskPositionValid, isFreeDeskPositionVisible, isRegularGridUsable, rebuildRegularLayout, snapDeskPosition } from './layout'
import type { DeskRecord } from './types'

const desk = (id: string, x: number, y: number, width = 150, height = 82): DeskRecord => ({ id, classId: 'class', kind: 'regular', capacity: 1, x, y, width, height, seatIds: [`seat-${id}`], createdAt: '2026-01-01', updatedAt: '2026-01-01' })

describe('classroom layout contracts', () => {
  it('snaps coordinates and keeps snap mode collision-free within its stage', () => {
    expect(snapDeskPosition({ x: 63, y: 138 })).toEqual({ x: 75, y: 150 })
    const desks = [desk('first', 50, 100), desk('second', 300, 100)]
    expect(isDeskPositionValid({ desks }, 'first', { x: 300, y: 100 })).toBe(false)
    expect(isDeskPositionValid({ desks }, 'first', { x: classroomStage.width - 149, y: 100 })).toBe(false)
  })

  it('expands the stage for real classroom grids instead of rejecting valid settings', () => {
    expect(isRegularGridUsable(10, 8)).toBe(true)
    const stage = classroomStageFor({ rows: 10, desksPerRow: 8 })
    expect(stage.width).toBeGreaterThan(classroomStage.width)
    expect(stage.height).toBeGreaterThan(classroomStage.height)
    const rebuilt = rebuildRegularLayout({ id: 'd', classId: 'class', podium: { x: 0, y: 0, width: 1, height: 1 }, desks: [], assignments: [], createdAt: '', updatedAt: '' }, { rows: 10, desksPerRow: 8, capacity: 2 }, { deskId: () => 'new', seatId: () => 'new-seat' }, '')
    expect(rebuilt.desks).toHaveLength(80)
  })

  it('aligns configured regular desks in the main grid and stable extras in side wings', () => {
    const desks = [...Array.from({ length: 6 }, (_, index) => desk(`regular-${index}`, 0, 0)), { ...desk('special-1', 0, 0), kind: 'special' as const }, { ...desk('special-2', 0, 0), kind: 'special' as const }]
    const stage = classroomStageFor({ rows: 2, desksPerRow: 2, sideDeskCount: 2 })
    const first = alignedDeskPositions(desks, { rows: 2, desksPerRow: 2 }, stage)
    const second = alignedDeskPositions(desks.map((item, index) => ({ ...item, ...first[index] })), { rows: 2, desksPerRow: 2 }, stage)
    expect(first).toEqual(second)
    expect(first.slice(0, 4).every((position) => position.x >= stage.originX && position.y >= stage.originY)).toBe(true)
    expect(first[4].x).toBeLessThan(stage.originX)
    expect(first[6].x).toBeGreaterThan(stage.originX + 2 * 190)
    expect(first.slice(4).every((position) => position.y >= stage.originY)).toBe(true)
  })

  it('allows overlap and podium-area positions in free mode while retaining a grab strip', () => {
    expect(isFreeDeskPositionVisible(desk('a', 0, 0), { x: 350, y: 20 })).toBe(true)
    expect(constrainFreeDeskPosition(desk('a', 0, 0), { x: -999, y: 9999 })).toEqual(expect.objectContaining({ x: -118, y: 618 }))
  })

  it('rebuilds regular desks and conserves special-seat students', () => {
    const special = { ...desk('special', 800, 100), kind: 'special' as const }
    const draft = { id: 'd', classId: 'class', podium: { x: 0, y: 0, width: 1, height: 1 }, desks: [desk('old', 0, 0), special], assignments: [{ seatId: 'seat-old', studentId: 'pool' }, { seatId: 'seat-special', studentId: 'kept' }], createdAt: '', updatedAt: '' }
    const rebuilt = rebuildRegularLayout(draft, { rows: 1, desksPerRow: 1, capacity: 2 }, { deskId: () => 'new', seatId: () => 'new-seat' }, '')
    expect(rebuilt.desks.find((item) => item.kind === 'special')?.id).toBe('special')
    expect(rebuilt.assignments).toEqual([{ seatId: 'seat-special', studentId: 'kept' }])
  })
})
