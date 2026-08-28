import fc from 'fast-check'
import type {
  BackupData,
  DeskRecord,
  LayoutDraft,
  SeatAssignment,
  StudentRecord,
} from '../../src/domain/types'

export const testTimestamp = '2026-08-01T12:00:00.000Z'

export interface SeatingScenario {
  students: StudentRecord[]
  seatIds: string[]
  assignments: SeatAssignment[]
  draft: LayoutDraft
}

interface ScenarioDimensions {
  studentCount: number
  seatCount: number
}

function scenarioArbitrary(dimensionsArbitrary: fc.Arbitrary<ScenarioDimensions>) {
  return dimensionsArbitrary.chain(({ studentCount, seatCount }) => {
    const deskCount = Math.ceil(seatCount / 2)
    const identifierCount = 2 + studentCount + seatCount + deskCount

    return fc.uniqueArray(fc.uuid(), {
      minLength: identifierCount,
      maxLength: identifierCount,
    }).map((identifiers): SeatingScenario => {
      let cursor = 0
      const classId = identifiers[cursor++]
      const draftId = identifiers[cursor++]
      const studentIds = identifiers.slice(cursor, cursor + studentCount)
      cursor += studentCount
      const seatIds = identifiers.slice(cursor, cursor + seatCount)
      cursor += seatCount
      const deskIds = identifiers.slice(cursor, cursor + deskCount)

      const students = studentIds.map((id, index): StudentRecord => ({
        id,
        classId,
        studentNo: String(index + 1).padStart(2, '0'),
        name: `虚构学生${String(index + 1).padStart(2, '0')}`,
        gender: index % 3 === 0 ? 'female' : index % 3 === 1 ? 'male' : 'unspecified',
        roles: index === 0 ? ['测试班长'] : [],
        performanceLevel: index % 4 === 0
          ? 'excellent'
          : index % 4 === 1
            ? 'good'
            : index % 4 === 2
              ? 'average'
              : 'needs_support',
        rank: index + 1,
        characterTags: ['虚构标签'],
        customTags: [],
        note: '仅用于自动化测试',
        contact: index === 0
          ? { phone: '000-000-0000', address: '虚构测试地址' }
          : {},
        constraints: {
          frontPreference: index % 5 === 0 ? 'preferred' : 'none',
          avoidAdjacentStudentIds: [],
          preferredDeskMateStudentIds: [],
        },
        archived: false,
        createdAt: testTimestamp,
        updatedAt: testTimestamp,
      }))

      const desks: DeskRecord[] = deskIds.map((id, index) => {
        const deskSeatIds = seatIds.slice(index * 2, index * 2 + 2)
        return {
          id,
          classId,
          kind: 'regular',
          capacity: deskSeatIds.length === 1 ? 1 : 2,
          x: (index % 4) * 160,
          y: Math.floor(index / 4) * 100,
          width: deskSeatIds.length === 1 ? 80 : 160,
          height: 72,
          seatIds: deskSeatIds,
          createdAt: testTimestamp,
          updatedAt: testTimestamp,
        }
      })

      const assignments = students
        .slice(0, seatCount)
        .map((student, index) => ({ studentId: student.id, seatId: seatIds[index] }))

      return {
        students,
        seatIds,
        assignments,
        draft: {
          id: draftId,
          classId,
          podium: { x: 240, y: 16, width: 160, height: 64 },
          desks,
          assignments,
          createdAt: testTimestamp,
          updatedAt: testTimestamp,
        },
      }
    })
  })
}

export const seatingScenarioArbitrary = scenarioArbitrary(
  fc.record({
    studentCount: fc.integer({ min: 0, max: 32 }),
    extraSeatCount: fc.integer({ min: 0, max: 8 }),
  }).map(({ studentCount, extraSeatCount }) => ({
    studentCount,
    seatCount: studentCount + extraSeatCount,
  })),
)

export const emptySeatingScenarioArbitrary = scenarioArbitrary(
  fc.constant({ studentCount: 0, seatCount: 0 }),
)

export const movableSeatingScenarioArbitrary = scenarioArbitrary(
  fc.record({
    studentCount: fc.integer({ min: 1, max: 32 }),
    extraSeatCount: fc.integer({ min: 1, max: 8 }),
  }).map(({ studentCount, extraSeatCount }) => ({
    studentCount,
    seatCount: studentCount + extraSeatCount,
  })),
)

export const swappableSeatingScenarioArbitrary = scenarioArbitrary(
  fc.record({
    studentCount: fc.integer({ min: 2, max: 32 }),
    extraSeatCount: fc.integer({ min: 0, max: 8 }),
  }).map(({ studentCount, extraSeatCount }) => ({
    studentCount,
    seatCount: studentCount + extraSeatCount,
  })),
)

export const insufficientSeatingScenarioArbitrary = fc
  .integer({ min: 1, max: 32 })
  .chain((studentCount) => fc.integer({ min: 0, max: studentCount - 1 })
    .map((seatCount) => ({ studentCount, seatCount })))
  .chain((dimensions) => scenarioArbitrary(fc.constant(dimensions)))

export const duplicateStudentNumberRoster = scenarioArbitrary(
  fc.integer({ min: 2, max: 32 }).map((studentCount) => ({
    studentCount,
    seatCount: studentCount,
  })),
).map(({ students }) => students.map((student, index) => (
  index === 1 ? { ...student, studentNo: students[0].studentNo } : student
)))

export const backupDataArbitrary: fc.Arbitrary<BackupData> = seatingScenarioArbitrary
  .chain((scenario) => fc.uuid().map((snapshotId) => ({
    classes: [{
      id: scenario.draft.classId,
      name: '虚构测试班级',
      grade: '测试年级',
      academicYear: '2026-2027',
      archived: false,
      createdAt: testTimestamp,
      updatedAt: testTimestamp,
    }],
    students: scenario.students,
    drafts: [scenario.draft],
    snapshots: [{
      id: snapshotId,
      classId: scenario.draft.classId,
      title: '虚构历史版本',
      effectiveAt: testTimestamp,
      layout: scenario.draft,
      studentNames: Object.fromEntries(
        scenario.students.map((student) => [student.id, student.name]),
      ),
      createdAt: testTimestamp,
      updatedAt: testTimestamp,
    }],
  })))
