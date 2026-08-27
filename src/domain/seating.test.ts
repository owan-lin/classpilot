import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { SeatAssignment } from './types'
import {
  generateDeskGrid,
  moveStudentToEmptySeat,
  placeStudent,
  swapOccupiedSeats,
} from './seating'

const uniqueAssignments = fc
  .tuple(
    fc.uniqueArray(fc.uuid(), { maxLength: 40 }),
    fc.uniqueArray(fc.uuid(), { maxLength: 40 }),
  )
  .map(([seatIds, studentIds]) =>
    seatIds
      .slice(0, Math.min(seatIds.length, studentIds.length))
      .map((seatId, index) => ({ seatId, studentId: studentIds[index] })),
  )

function expectOneToOne(assignments: readonly SeatAssignment[]): void {
  expect(new Set(assignments.map(({ seatId }) => seatId))).toHaveProperty('size', assignments.length)
  expect(new Set(assignments.map(({ studentId }) => studentId))).toHaveProperty('size', assignments.length)
}

describe('seating assignment properties', () => {
  it('keeps assignments one-to-one when a student is placed', () => {
    fc.assert(
      fc.property(uniqueAssignments, fc.uuid(), fc.uuid(), (assignments, studentId, seatId) => {
        expectOneToOne(placeStudent(assignments, studentId, seatId))
      }),
    )
  })

  it('moving to an empty seat preserves all students and assignment count', () => {
    fc.assert(
      fc.property(uniqueAssignments, fc.uuid(), fc.uuid(), (assignments, studentId, emptySeatId) => {
        fc.pre(!assignments.some(({ seatId }) => seatId === emptySeatId))
        const result = moveStudentToEmptySeat(assignments, studentId, emptySeatId)
        const expectedCount = assignments.some(({ studentId: id }) => id === studentId)
          ? assignments.length
          : assignments.length + 1
        expect(result).toHaveLength(expectedCount)
        expect(result).toContainEqual({ studentId, seatId: emptySeatId })
        expectOneToOne(result)
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
