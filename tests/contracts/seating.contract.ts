import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { SeatAssignment } from '../../src/domain/types'
import {
  movableSeatingScenarioArbitrary,
  seatingScenarioArbitrary,
  swappableSeatingScenarioArbitrary,
} from '../fixtures/classroom'

export interface SeatingOperationsContract {
  moveAssignment(
    assignments: readonly SeatAssignment[],
    studentId: string,
    targetSeatId: string,
  ): SeatAssignment[]
  normalizeAssignments(assignments: readonly SeatAssignment[]): SeatAssignment[]
  swapAssignments(
    assignments: readonly SeatAssignment[],
    firstSeatId: string,
    secondSeatId: string,
  ): SeatAssignment[]
}

function expectOneToOne(assignments: readonly SeatAssignment[]) {
  expect(new Set(assignments.map(({ seatId }) => seatId)).size).toBe(assignments.length)
  expect(new Set(assignments.map(({ studentId }) => studentId)).size).toBe(assignments.length)
}

function sorted(values: readonly string[]) {
  return [...values].sort()
}

function sortedAssignmentKeys(assignments: readonly SeatAssignment[]) {
  return sorted(assignments.map(({ seatId, studentId }) => `${studentId}:${seatId}`))
}

export function defineSeatingOperationsContract(
  createOperations: () => SeatingOperationsContract,
) {
  describe('seating operation properties', () => {
    it('normalization is idempotent and preserves valid one-to-one assignments', () => {
      fc.assert(fc.property(seatingScenarioArbitrary, ({ assignments }) => {
        const operations = createOperations()
        const original = structuredClone(assignments)
        const once = operations.normalizeAssignments(assignments)
        const twice = operations.normalizeAssignments(once)

        expect(assignments).toEqual(original)
        expect(twice).toEqual(once)
        expectOneToOne(once)
        expect(sortedAssignmentKeys(once)).toEqual(sortedAssignmentKeys(assignments))
      }), { numRuns: 200 })
    })

    it('moving to an empty seat preserves students and one-to-one assignment', () => {
      fc.assert(fc.property(movableSeatingScenarioArbitrary, ({ assignments, seatIds }) => {
        const operations = createOperations()
        const original = structuredClone(assignments)
        const source = assignments[0]
        const targetSeatId = seatIds[assignments.length]
        const moved = operations.moveAssignment(assignments, source.studentId, targetSeatId)

        expect(assignments).toEqual(original)
        expectOneToOne(moved)
        expect(sorted(moved.map(({ studentId }) => studentId)))
          .toEqual(sorted(assignments.map(({ studentId }) => studentId)))
        expect(moved).toContainEqual({ studentId: source.studentId, seatId: targetSeatId })
      }), { numRuns: 200 })
    })

    it('swapping occupied seats preserves the student and seat sets', () => {
      fc.assert(fc.property(swappableSeatingScenarioArbitrary, ({ assignments }) => {
        const operations = createOperations()
        const original = structuredClone(assignments)
        const [first, second] = assignments
        const swapped = operations.swapAssignments(assignments, first.seatId, second.seatId)

        expect(assignments).toEqual(original)
        expectOneToOne(swapped)
        expect(sorted(swapped.map(({ studentId }) => studentId)))
          .toEqual(sorted(assignments.map(({ studentId }) => studentId)))
        expect(sorted(swapped.map(({ seatId }) => seatId)))
          .toEqual(sorted(assignments.map(({ seatId }) => seatId)))
        expect(swapped).toContainEqual({ studentId: first.studentId, seatId: second.seatId })
        expect(swapped).toContainEqual({ studentId: second.studentId, seatId: first.seatId })

        const restored = operations.swapAssignments(swapped, first.seatId, second.seatId)
        expect(sortedAssignmentKeys(restored)).toEqual(sortedAssignmentKeys(assignments))
      }), { numRuns: 200 })
    })
  })
}
