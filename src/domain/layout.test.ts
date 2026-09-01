import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { alignedDeskPositions, classroomStage, classroomStageFor, constrainFreeDeskPosition, isDeskPositionValid, isFreeDeskPositionVisible, isRegularGridUsable, rebuildRegularLayout, regularDeskSpec, snapDeskPosition } from './layout'
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
    expect(classroomStageFor({ rows: 2, desksPerRow: 3 }).width).toBe(1000)
    expect(isRegularGridUsable(10, 8)).toBe(true)
    const stage = classroomStageFor({ rows: 10, desksPerRow: 8 })
    expect(stage.width).toBeGreaterThan(classroomStage.width)
    expect(stage.height).toBeGreaterThan(classroomStage.height)
    const rebuilt = rebuildRegularLayout({ id: 'd', classId: 'class', podium: { x: 0, y: 0, width: 1, height: 1 }, desks: [], assignments: [], createdAt: '', updatedAt: '' }, { rows: 10, desksPerRow: 8, capacity: 2 }, { deskId: () => 'new', seatId: () => 'new-seat' }, '')
    expect(rebuilt.desks).toHaveLength(80)
  })

  it('aligns configured regular desks in the main grid and balances overflow across side wings', () => {
    const desks = [...Array.from({ length: 6 }, (_, index) => desk(`regular-${index}`, 0, 0)), { ...desk('special-1', 0, 0), kind: 'special' as const }, { ...desk('special-2', 0, 0), kind: 'special' as const }]
    const stage = classroomStageFor({ rows: 2, desksPerRow: 2, sideDeskCount: 4 })
    expect(stage.width).toBeGreaterThanOrEqual(classroomStage.width)
    const first = alignedDeskPositions(desks, { rows: 2, desksPerRow: 2 }, stage)
    const second = alignedDeskPositions(desks.map((item, index) => ({ ...item, ...first[index] })), { rows: 2, desksPerRow: 2 }, stage)
    expect(first).toEqual(second)
    expect(first.slice(0, 4).every((position) => position.x >= stage.originX && position.y >= stage.originY)).toBe(true)
    expect(first[4].x).toBeLessThan(stage.originX)
    expect(first[5].x).toBeGreaterThan(stage.originX + 2 * 200)
    expect(first[6].x).toBeLessThan(stage.originX)
    expect(first[7].x).toBeGreaterThan(stage.originX + 2 * 200)
    expect(first.slice(4).every((position) => position.y >= stage.originY)).toBe(true)
  })

  it('keeps a large overflow inside bounded, label-safe left and right wings', () => {
    const rows = 2, desksPerRow = 3
    const regular = Array.from({ length: 17 }, (_, index) => desk(`regular-${index}`, 0, 0))
    const special = Array.from({ length: 5 }, (_, index) => ({ ...desk(`special-${index}`, 0, 0, 120, 82), kind: 'special' as const }))
    const desks = [...regular, ...special]
    const overflowCount = desks.length - rows * desksPerRow
    const stage = classroomStageFor({ rows, desksPerRow, sideDeskCount: overflowCount })
    const positions = alignedDeskPositions(desks, { rows, desksPerRow }, stage)
    const mainRight = stage.originX + desksPerRow * 200 + (desksPerRow - 1) * stage.gapX
    const overflow = positions.slice(rows * desksPerRow)

    expect(stage.sideColumnCount).toBe(Math.ceil(overflowCount / (rows * 2)))
    expect(overflow.filter((_, index) => index % 2 === 0).every((position) => position.x >= stage.rowLabelGutter && position.x < stage.originX)).toBe(true)
    expect(overflow.filter((_, index) => index % 2 === 1).every((position) => position.x >= mainRight + stage.sideGap && position.x < stage.width)).toBe(true)
    expect(overflow.every((position) => position.y >= stage.originY && position.y < stage.originY + rows * (regularDeskSpec.height + stage.gapY))).toBe(true)
  })

  it('keeps aligned layouts stable without changing desk identities or assignments', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 0, max: 8 }),
      (rows, desksPerRow, regularCount, specialCount) => {
        const regular = Array.from({ length: regularCount }, (_, index) => desk(`regular-${index}`, index * 11, index * 7))
        const special = Array.from({ length: specialCount }, (_, index) => ({ ...desk(`special-${index}`, index * 13, index * 5), kind: 'special' as const }))
        const desks = [...regular, ...special]
        const mainCount = Math.min(regular.length, rows * desksPerRow)
        const overflowCount = regular.length - mainCount + special.length
        const stage = classroomStageFor({ rows, desksPerRow, sideDeskCount: overflowCount })
        const first = alignedDeskPositions(desks, { rows, desksPerRow }, stage)
        const repositioned = desks.map((item, index) => ({ ...item, ...first[index] }))
        const second = alignedDeskPositions(repositioned, { rows, desksPerRow }, stage)
        const assignments = desks.map((item, index) => ({ seatId: item.seatIds[0], studentId: `student-${index}` }))
        const draft = { id: 'draft', classId: 'class', podium: { x: 400, y: 0, width: 200, height: 64 }, desks, assignments, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
        const alignedDraft = { ...draft, desks: repositioned }
        const mainRight = stage.originX + desksPerRow * 200 + (desksPerRow - 1) * stage.gapX

        expect(first).toHaveLength(desks.length)
        expect(second).toEqual(first)
        expect(alignedDraft.desks.map((item) => item.id)).toEqual(draft.desks.map((item) => item.id))
        expect(alignedDraft.assignments).toEqual(draft.assignments)
        expect(first.slice(0, mainCount).every((position) => position.x >= stage.originX && position.y >= stage.originY)).toBe(true)
        expect(first.slice(mainCount).every((position) => position.y >= stage.originY && position.y < stage.originY + rows * (regularDeskSpec.height + stage.gapY))).toBe(true)
        expect(first.slice(mainCount).filter((_, index) => index % 2 === 0).every((position) => position.x >= stage.rowLabelGutter && position.x < stage.originX)).toBe(true)
        expect(first.slice(mainCount).filter((_, index) => index % 2 === 1).every((position) => position.x >= mainRight + stage.sideGap && position.x < stage.width)).toBe(true)
      },
    ), { numRuns: 100 })
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
