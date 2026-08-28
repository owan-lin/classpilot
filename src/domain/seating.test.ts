import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { DeskRecord, SeatAssignment } from './types'
import {
  generateDeskGrid,
  moveStudentToEmptySeat,
  placeStudent,
  swapOccupiedSeats,
} from './seating'
import { isDeskPositionValid, snapDeskPosition } from './layout'

// The final identifier is always a seat not used by the assignments. The
// construction keeps the precondition in the generator instead of assuming it.
const assignmentAndEmptySeat = fc
  .uniqueArray(fc.uuid(), { minLength: 5, maxLength: 25 })
  .map((ids) => {
    const count = Math.floor((ids.length - 1) / 2)
    const seatIds = ids.slice(0, count)
    const studentIds = ids.slice(count, count * 2)
    return {
      assignments: seatIds.map((seatId, index) => ({ seatId, studentId: studentIds[index] })),
      studentId: studentIds[0],
      emptySeatId: ids[count * 2],
    }
  })

const placementScenario = fc
  .uniqueArray(fc.uuid(), { minLength: 4, maxLength: 40 })
  .map((ids) => {
    const count = Math.floor((ids.length - 2) / 2)
    const assignments = ids.slice(0, count).map((seatId, index) => ({
      seatId,
      studentId: ids[count + index],
    }))
    return { assignments, studentId: ids[count * 2], seatId: ids[count * 2 + 1] }
  })

const collisionFreeDeskPosition = fc
  .record({ x: fc.integer({ min: 0, max: 7 }), y: fc.integer({ min: 3, max: 15 }) })
  .map(({ x, y }) => ({ x: x * 50, y: y * 25 }))

const outOfBoundsDeskPosition = fc.oneof(
  fc.integer({ min: -200, max: -1 }).map((x) => ({ x, y: 100 })),
  fc.integer({ min: 851, max: 1100 }).map((x) => ({ x, y: 100 })),
  fc.integer({ min: -200, max: 74 }).map((y) => ({ x: 100, y })),
  fc.integer({ min: 569, max: 900 }).map((y) => ({ x: 100, y })),
)

const desk = (id: string, x: number, y: number): DeskRecord => ({
  id,
  classId: 'class',
  kind: 'regular',
  capacity: 1,
  x,
  y,
  width: 150,
  height: 82,
  seatIds: [`seat-${id}`],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

function expectOneToOne(assignments: readonly SeatAssignment[]): void {
  expect(new Set(assignments.map(({ seatId }) => seatId))).toHaveProperty('size', assignments.length)
  expect(new Set(assignments.map(({ studentId }) => studentId))).toHaveProperty('size', assignments.length)
}

describe('seating assignment properties', () => {
  it('keeps assignments one-to-one when a student is placed', () => {
    fc.assert(
      fc.property(placementScenario, ({ assignments, studentId, seatId }) => {
        expectOneToOne(placeStudent(assignments, studentId, seatId))
      }),
    )
  })

  it('moving to an empty seat preserves all students and assignment count', () => {
    fc.assert(
      fc.property(assignmentAndEmptySeat, ({ assignments, studentId, emptySeatId }) => {
        const result = moveStudentToEmptySeat(assignments, studentId, emptySeatId)
        expect(result).toHaveLength(assignments.length)
        expect(result).toContainEqual({ studentId, seatId: emptySeatId })
        expectOneToOne(result)
        expect(new Set(result.map(({ studentId: id }) => id))).toEqual(
          new Set(assignments.map(({ studentId: id }) => id)),
        )
      }),
    )
  })

  it('placing an assigned student into an occupied seat preserves the student and seat sets', () => {
    fc.assert(
      fc.property(assignmentAndEmptySeat, ({ assignments, studentId }) => {
        const targetSeatId = assignments[1].seatId
        const result = placeStudent(assignments, studentId, targetSeatId)
        expect(result).toHaveLength(assignments.length)
        expectOneToOne(result)
        expect(new Set(result.map(({ studentId: id }) => id))).toEqual(
          new Set(assignments.map(({ studentId: id }) => id)),
        )
        expect(new Set(result.map(({ seatId }) => seatId))).toEqual(
          new Set(assignments.map(({ seatId }) => seatId)),
        )
      }),
    )
  })

  it('swapping twice restores the original seat-to-student mapping', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 12 }), (studentIds) => {
        const assignments = studentIds.map((studentId, index) => ({ seatId: `seat-${index}`, studentId }))
        const firstSwap = swapOccupiedSeats(assignments, 'seat-0', 'seat-1')
        expect(swapOccupiedSeats(firstSwap, 'seat-0', 'seat-1')).toEqual(assignments)
      }),
    )
  })
})

describe('desk grid properties', () => {
  it('generates unique IDs with the configured capacity and dimensions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom<1 | 2>(1, 2),
        (rows, desksPerRow, capacity) => {
          const desks = generateDeskGrid(
            { classId: 'class-a', rows, desksPerRow, capacity },
            {
              deskId: (row, column) => `desk-${row}-${column}`,
              seatId: (row, column, position) => `seat-${row}-${column}-${position}`,
            },
            '2026-01-01T00:00:00.000Z',
          )
          expect(desks).toHaveLength(rows * desksPerRow)
          expect(new Set(desks.map(({ id }) => id))).toHaveProperty('size', desks.length)
          const seatIds = desks.flatMap(({ seatIds }) => seatIds)
          expect(seatIds).toHaveLength(rows * desksPerRow * capacity)
          expect(new Set(seatIds)).toHaveProperty('size', seatIds.length)
        },
      ),
    )
  })
})

describe('layout properties', () => {
  it('snapping is idempotent and always lands on grid intersections', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: -10000, max: 10000 }).map((value) => value + 0.37),
          y: fc.integer({ min: -10000, max: 10000 }).map((value) => value + 0.63),
        }),
        (position) => {
          const snapped = snapDeskPosition(position)
          expect(snapDeskPosition(snapped)).toEqual(snapped)
          expect(Math.abs(snapped.x % 25)).toBe(0)
          expect(Math.abs(snapped.y % 25)).toBe(0)
        },
      ),
    )
  })

  it('accepts generated in-bounds non-overlapping positions', () => {
    fc.assert(
      fc.property(collisionFreeDeskPosition, (position) => {
        const first = desk('first', 0, 100)
        const other = desk('other', 500, 100)
        expect(isDeskPositionValid({ desks: [first, other] }, 'first', position)).toBe(true)
      }),
    )
  })

  it('rejects generated out-of-bounds positions', () => {
    fc.assert(
      fc.property(outOfBoundsDeskPosition, (position) => {
        const first = desk('first', 0, 100)
        const other = desk('other', 500, 100)
        expect(isDeskPositionValid({ desks: [first, other] }, 'first', position)).toBe(false)
      }),
    )
  })

  it('rejects a generated position that collides with another desk', () => {
    const first = desk('first', 0, 100)
    const other = desk('other', 500, 100)
    expect(isDeskPositionValid({ desks: [first, other] }, 'first', { x: 500, y: 100 })).toBe(false)
  })
})
