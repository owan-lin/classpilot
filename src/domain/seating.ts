import type {
  DeskRecord,
  EntityId,
  ISODateTime,
  LayoutDraft,
  SeatAssignment,
  StudentRecord,
} from './types'

export interface GridConfiguration {
  classId: EntityId
  rows: number
  desksPerRow: number
  capacity: 1 | 2
  originX?: number
  originY?: number
  deskWidth?: number
  deskHeight?: number
  horizontalGap?: number
  verticalGap?: number
}

export interface GridIdentityFactory {
  deskId(row: number, column: number): EntityId
  seatId(row: number, column: number, position: number): EntityId
}

export type SeatingWarningCode =
  | 'duplicate-seat'
  | 'duplicate-student'
  | 'unknown-seat'
  | 'unknown-student'
  | 'front-required'
  | 'front-preferred'
  | 'avoid-desk-mate'
  | 'preferred-desk-mate'

export interface SeatingWarning {
  code: SeatingWarningCode
  severity: 'warning' | 'error'
  message: string
  studentIds: EntityId[]
  seatIds: EntityId[]
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`)
  }
}

/** Builds a deterministic desk grid. Time and IDs are explicit to keep the domain pure. */
export function generateDeskGrid(
  configuration: GridConfiguration,
  identities: GridIdentityFactory,
  timestamp: ISODateTime,
): DeskRecord[] {
  assertPositiveInteger(configuration.rows, 'rows')
  assertPositiveInteger(configuration.desksPerRow, 'desksPerRow')

  const originX = configuration.originX ?? 0
  const originY = configuration.originY ?? 0
  const width = configuration.deskWidth ?? 180
  const height = configuration.deskHeight ?? 100
  const horizontalGap = configuration.horizontalGap ?? 40
  const verticalGap = configuration.verticalGap ?? 48
  const desks: DeskRecord[] = []

  for (let row = 0; row < configuration.rows; row += 1) {
    for (let column = 0; column < configuration.desksPerRow; column += 1) {
      const seatIds = Array.from({ length: configuration.capacity }, (_, position) =>
        identities.seatId(row, column, position),
      )
      desks.push({
        id: identities.deskId(row, column),
        classId: configuration.classId,
        kind: 'regular',
        capacity: configuration.capacity,
        x: originX + column * (width + horizontalGap),
        y: originY + row * (height + verticalGap),
        width,
        height,
        seatIds,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  }

  return desks
}

function assignmentIndexBySeat(assignments: readonly SeatAssignment[], seatId: EntityId): number {
  return assignments.findIndex((assignment) => assignment.seatId === seatId)
}

function assignmentIndexByStudent(
  assignments: readonly SeatAssignment[],
  studentId: EntityId,
): number {
  return assignments.findIndex((assignment) => assignment.studentId === studentId)
}

/** Moves an assigned student into an empty seat, or assigns one from the pool. */
export function moveStudentToEmptySeat(
  assignments: readonly SeatAssignment[],
  studentId: EntityId,
  targetSeatId: EntityId,
): SeatAssignment[] {
  if (assignmentIndexBySeat(assignments, targetSeatId) >= 0) {
    throw new Error(`Seat ${targetSeatId} is occupied`)
  }

  const sourceIndex = assignmentIndexByStudent(assignments, studentId)
  if (sourceIndex < 0) return [...assignments, { seatId: targetSeatId, studentId }]

  return assignments.map((assignment, index) =>
    index === sourceIndex ? { seatId: targetSeatId, studentId } : { ...assignment },
  )
}

/** Swaps the occupants of two occupied seats. */
export function swapOccupiedSeats(
  assignments: readonly SeatAssignment[],
  firstSeatId: EntityId,
  secondSeatId: EntityId,
): SeatAssignment[] {
  if (firstSeatId === secondSeatId) return assignments.map((assignment) => ({ ...assignment }))

  const firstIndex = assignmentIndexBySeat(assignments, firstSeatId)
  const secondIndex = assignmentIndexBySeat(assignments, secondSeatId)
  if (firstIndex < 0 || secondIndex < 0) {
    throw new Error('Both seats must be occupied before swapping')
  }

  const firstStudentId = assignments[firstIndex].studentId
  const secondStudentId = assignments[secondIndex].studentId
  return assignments.map((assignment, index) => {
    if (index === firstIndex) return { seatId: firstSeatId, studentId: secondStudentId }
    if (index === secondIndex) return { seatId: secondSeatId, studentId: firstStudentId }
    return { ...assignment }
  })
}

/**
 * Places a student from either a seat or the pool. Occupied targets are swapped;
 * when the incoming student was in the pool, the displaced student returns there.
 */
export function placeStudent(
  assignments: readonly SeatAssignment[],
  studentId: EntityId,
  targetSeatId: EntityId,
): SeatAssignment[] {
  const sourceIndex = assignmentIndexByStudent(assignments, studentId)
  const targetIndex = assignmentIndexBySeat(assignments, targetSeatId)

  if (sourceIndex >= 0 && assignments[sourceIndex].seatId === targetSeatId) {
    return assignments.map((assignment) => ({ ...assignment }))
  }
  if (sourceIndex >= 0 && targetIndex >= 0) {
    return swapOccupiedSeats(assignments, assignments[sourceIndex].seatId, targetSeatId)
  }
  if (targetIndex < 0) return moveStudentToEmptySeat(assignments, studentId, targetSeatId)

  return assignments
    .filter((_, index) => index !== targetIndex)
    .map((assignment) => ({ ...assignment }))
    .concat({ seatId: targetSeatId, studentId })
}

export function unassignStudent(
  assignments: readonly SeatAssignment[],
  studentId: EntityId,
): SeatAssignment[] {
  return assignments
    .filter((assignment) => assignment.studentId !== studentId)
    .map((assignment) => ({ ...assignment }))
}

export function getStudentPool(
  students: readonly StudentRecord[],
  assignments: readonly SeatAssignment[],
): StudentRecord[] {
  const assigned = new Set(assignments.map((assignment) => assignment.studentId))
  return students
    .filter((student) => !student.archived && !assigned.has(student.id))
    .map((student) => structuredClone(student))
}

function getDeskMateIds(
  desk: DeskRecord,
  assignmentsBySeat: ReadonlyMap<EntityId, SeatAssignment>,
  studentId: EntityId,
): EntityId[] {
  return desk.seatIds
    .map((seatId) => assignmentsBySeat.get(seatId)?.studentId)
    .filter((candidate): candidate is EntityId => Boolean(candidate) && candidate !== studentId)
}

/** Returns constraint warnings plus structural assignment errors. */
export function getSeatingWarnings(
  draft: Pick<LayoutDraft, 'desks' | 'assignments'>,
  students: readonly StudentRecord[],
): SeatingWarning[] {
  const warnings: SeatingWarning[] = []
  const seats = new Set(draft.desks.flatMap((desk) => desk.seatIds))
  const studentsById = new Map(students.map((student) => [student.id, student]))
  const seenSeats = new Set<EntityId>()
  const seenStudents = new Set<EntityId>()
  const assignmentsBySeat = new Map<EntityId, SeatAssignment>()

  for (const assignment of draft.assignments) {
    if (seenSeats.has(assignment.seatId)) {
      warnings.push({ code: 'duplicate-seat', severity: 'error', message: '一个座位被重复占用', studentIds: [assignment.studentId], seatIds: [assignment.seatId] })
    }
    if (seenStudents.has(assignment.studentId)) {
      warnings.push({ code: 'duplicate-student', severity: 'error', message: '同一学生被安排到多个座位', studentIds: [assignment.studentId], seatIds: [assignment.seatId] })
    }
    if (!seats.has(assignment.seatId)) {
      warnings.push({ code: 'unknown-seat', severity: 'error', message: '座位不存在于当前教室', studentIds: [assignment.studentId], seatIds: [assignment.seatId] })
    }
    if (!studentsById.has(assignment.studentId)) {
      warnings.push({ code: 'unknown-student', severity: 'error', message: '学生不存在于当前班级', studentIds: [assignment.studentId], seatIds: [assignment.seatId] })
    }
    seenSeats.add(assignment.seatId)
    seenStudents.add(assignment.studentId)
    if (!assignmentsBySeat.has(assignment.seatId)) assignmentsBySeat.set(assignment.seatId, assignment)
  }

  const regularRows = draft.desks.filter((desk) => desk.kind === 'regular').map((desk) => desk.y)
  const frontY = regularRows.length > 0 ? Math.min(...regularRows) : undefined

  for (const desk of draft.desks) {
    for (const seatId of desk.seatIds) {
      const assignment = assignmentsBySeat.get(seatId)
      if (!assignment) continue
      const student = studentsById.get(assignment.studentId)
      if (!student) continue

      const deskMateIds = getDeskMateIds(desk, assignmentsBySeat, student.id)
      const avoided = deskMateIds.filter((id) => student.constraints.avoidAdjacentStudentIds.includes(id))
      if (avoided.length > 0) {
        warnings.push({ code: 'avoid-desk-mate', severity: 'warning', message: `${student.name} 与应避免相邻的学生同桌`, studentIds: [student.id, ...avoided], seatIds: [...desk.seatIds] })
      }

      const preferred = student.constraints.preferredDeskMateStudentIds
      if (preferred.length > 0 && !preferred.some((id) => deskMateIds.includes(id))) {
        warnings.push({ code: 'preferred-desk-mate', severity: 'warning', message: `${student.name} 未与偏好的同桌相邻`, studentIds: [student.id, ...preferred], seatIds: [seatId] })
      }

      if (frontY !== undefined && desk.kind === 'regular' && desk.y !== frontY) {
        if (student.constraints.frontPreference === 'required') {
          warnings.push({ code: 'front-required', severity: 'error', message: `${student.name} 需要安排在前排`, studentIds: [student.id], seatIds: [seatId] })
        } else if (student.constraints.frontPreference === 'preferred') {
          warnings.push({ code: 'front-preferred', severity: 'warning', message: `${student.name} 偏好安排在前排`, studentIds: [student.id], seatIds: [seatId] })
        }
      }
    }
  }

  return warnings
}
