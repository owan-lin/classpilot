import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  backupEnvelopeArbitrary,
  duplicateStudentNumberRoster,
  emptySeatingScenarioArbitrary,
  insufficientSeatingScenarioArbitrary,
  seatingScenarioArbitrary,
} from '../fixtures/classroom'

function isUnique(values: readonly string[]) {
  return new Set(values).size === values.length
}

describe('fictional classroom arbitraries', () => {
  it('generates one-to-one assignments with stable unique identifiers', () => {
    fc.assert(fc.property(seatingScenarioArbitrary, ({ students, seatIds, assignments }) => {
      expect(isUnique(students.map(({ id }) => id))).toBe(true)
      expect(isUnique(students.map(({ studentNo }) => studentNo))).toBe(true)
      expect(isUnique(seatIds)).toBe(true)
      expect(isUnique(assignments.map(({ studentId }) => studentId))).toBe(true)
      expect(isUnique(assignments.map(({ seatId }) => seatId))).toBe(true)
      expect(assignments.length).toBe(students.length)
    }), { numRuns: 200 })
  })

  it('generates the seat-shortage boundary by construction', () => {
    fc.assert(fc.property(insufficientSeatingScenarioArbitrary, ({ students, seatIds }) => {
      expect(seatIds.length).toBeLessThan(students.length)
    }), { numRuns: 100 })
  })

  it('represents an empty class without seats or assignments', () => {
    fc.assert(fc.property(emptySeatingScenarioArbitrary, ({ assignments, seatIds, students }) => {
      expect(students).toEqual([])
      expect(seatIds).toEqual([])
      expect(assignments).toEqual([])
    }), { numRuns: 1 })
  })

  it('generates duplicate student-number rosters without duplicate entity IDs', () => {
    fc.assert(fc.property(duplicateStudentNumberRoster, (students) => {
      expect(isUnique(students.map(({ id }) => id))).toBe(true)
      expect(isUnique(students.map(({ studentNo }) => studentNo))).toBe(false)
    }), { numRuns: 100 })
  })

  it('generates self-consistent full backup envelopes with fictional data', () => {
    fc.assert(fc.property(backupEnvelopeArbitrary, (backup) => {
      const classIds = new Set(backup.classes.map(({ id }) => id))
      const studentIds = new Set(backup.students.map(({ id }) => id))

      expect(backup.schemaVersion).toBe(1)
      expect(backup.students.every(({ classId }) => classIds.has(classId))).toBe(true)
      expect(backup.drafts.every(({ classId }) => classIds.has(classId))).toBe(true)
      expect(backup.snapshots.every(({ classId }) => classIds.has(classId))).toBe(true)
      expect(backup.drafts.flatMap(({ assignments }) => assignments)
        .every(({ studentId }) => studentIds.has(studentId))).toBe(true)
      expect(backup.students.every(({ name }) => name.startsWith('虚构学生'))).toBe(true)
    }), { numRuns: 100 })
  })
})
