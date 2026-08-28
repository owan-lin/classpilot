import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  getStudentPool,
  moveStudentToEmptySeat,
  swapOccupiedSeats,
} from '../../src/domain/seating'
import { canonicalStudentNo } from '../../src/data/repository'
import {
  insufficientSeatingScenarioArbitrary,
  movableSeatingScenarioArbitrary,
  swappableSeatingScenarioArbitrary,
} from '../fixtures/classroom'

const studentNoArbitrary = fc.string({
  unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
  minLength: 1,
  maxLength: 12,
})

function sorted(values: readonly string[]) {
  return [...values].sort()
}

function expectOneToOne(assignments: readonly { seatId: string; studentId: string }[]) {
  expect(new Set(assignments.map(({ seatId }) => seatId)).size).toBe(assignments.length)
  expect(new Set(assignments.map(({ studentId }) => studentId)).size).toBe(assignments.length)
}

describe('seating domain contracts', () => {
  it('canonicalizes student numbers idempotently', () => {
    fc.assert(fc.property(studentNoArbitrary, (studentNo) => {
      const decorated = `　${studentNo}  `
      const once = canonicalStudentNo(decorated)
      expect(canonicalStudentNo(once)).toBe(once)
      expect(once).toBe(studentNo.toLowerCase())
    }), { numRuns: 200 })
  })

  it('moves a student to an empty seat without mutation or loss', () => {
    fc.assert(fc.property(movableSeatingScenarioArbitrary, ({ assignments, seatIds }) => {
      const original = structuredClone(assignments)
      const source = assignments[0]
      const targetSeatId = seatIds[assignments.length]
      const moved = moveStudentToEmptySeat(assignments, source.studentId, targetSeatId)

      expect(assignments).toEqual(original)
      expectOneToOne(moved)
      expect(sorted(moved.map(({ studentId }) => studentId)))
        .toEqual(sorted(assignments.map(({ studentId }) => studentId)))
      expect(moved).toContainEqual({ studentId: source.studentId, seatId: targetSeatId })
    }), { numRuns: 200 })
  })

  it('swaps occupied seats without losing students and is its own inverse', () => {
    fc.assert(fc.property(swappableSeatingScenarioArbitrary, ({ assignments }) => {
      const original = structuredClone(assignments)
      const [first, second] = assignments
      const swapped = swapOccupiedSeats(assignments, first.seatId, second.seatId)
      const restored = swapOccupiedSeats(swapped, first.seatId, second.seatId)

      expect(assignments).toEqual(original)
      expectOneToOne(swapped)
      expect(sorted(swapped.map(({ studentId }) => studentId)))
        .toEqual(sorted(assignments.map(({ studentId }) => studentId)))
      expect(sorted(swapped.map(({ seatId }) => seatId)))
        .toEqual(sorted(assignments.map(({ seatId }) => seatId)))
      expect(restored).toEqual(assignments)
    }), { numRuns: 200 })
  })

  it('keeps every unassigned student in the pool when seats are insufficient', () => {
    fc.assert(fc.property(insufficientSeatingScenarioArbitrary, ({ assignments, students }) => {
      const pool = getStudentPool(students, assignments)
      const assigned = new Set(assignments.map(({ studentId }) => studentId))

      expect(pool.map(({ id }) => id).sort())
        .toEqual(students.filter(({ id }) => !assigned.has(id)).map(({ id }) => id).sort())
      expect(pool.length).toBeGreaterThan(0)
    }), { numRuns: 200 })
  })
})
