export type EntityId = string
export type ISODateTime = string
export type Gender = 'male' | 'female' | 'unspecified'
export type PerformanceLevel = 'excellent' | 'good' | 'average' | 'needs_support'
export type FrontPreference = 'none' | 'preferred' | 'required'

export interface BaseRecord {
  id: EntityId
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface ClassRecord extends BaseRecord {
  name: string
  grade: string
  academicYear: string
  plannedStudentCount: number
  rows: number
  desksPerRow: number
  deskCapacity: 1 | 2
  archived: boolean
}

export interface ContactProfile {
  phone?: string
  address?: string
}

export interface SeatingConstraints {
  frontPreference: FrontPreference
  avoidAdjacentStudentIds: EntityId[]
  preferredDeskMateStudentIds: EntityId[]
}

export interface StudentRecord extends BaseRecord {
  classId: EntityId
  studentNo: string
  name: string
  gender: Gender
  roles: string[]
  performanceLevel: PerformanceLevel
  rank?: number
  characterTags: string[]
  customTags: string[]
  note: string
  contact: ContactProfile
  constraints: SeatingConstraints
  archived: boolean
}

export interface DeskRecord extends BaseRecord {
  classId: EntityId
  kind: 'regular' | 'special'
  capacity: 1 | 2
  x: number
  y: number
  width: number
  height: number
  seatIds: EntityId[]
}

export interface SeatAssignment {
  seatId: EntityId
  studentId: EntityId
}

export interface LayoutDraft extends BaseRecord {
  classId: EntityId
  podium: { x: number; y: number; width: number; height: number }
  desks: DeskRecord[]
  assignments: SeatAssignment[]
}

/** Pre-beta score record. Dates are ISO calendar dates (YYYY-MM-DD). */
export interface GradeRecord extends BaseRecord {
  classId: EntityId
  studentId: EntityId
  subject: string
  examName: string
  examDate: string
  score: number
  fullScore: number
  note?: string
}

export type NewClassRecord = Pick<ClassRecord, 'name' | 'grade' | 'academicYear'> &
  Partial<Pick<ClassRecord, 'plannedStudentCount' | 'rows' | 'desksPerRow' | 'deskCapacity' | 'archived'>>

export type ClassRecordChanges = Partial<
  Pick<ClassRecord, 'name' | 'grade' | 'academicYear' | 'plannedStudentCount' | 'rows' | 'desksPerRow' | 'deskCapacity' | 'archived'>
>

export type NewStudentRecord = Omit<StudentRecord, keyof BaseRecord>
export type StudentRecordChanges = Partial<
  Omit<StudentRecord, keyof BaseRecord | 'classId'>
>

export type NewGradeRecord = Omit<GradeRecord, keyof BaseRecord>
export type GradeRecordChanges = Partial<Omit<GradeRecord, keyof BaseRecord | 'classId' | 'studentId'>>
export type GradeDuplicateStrategy = 'reject' | 'skip' | 'replace'

export interface GradeImportRow {
  rowNumber: number
  raw: Record<string, string>
  studentNo?: string
  studentName?: string
  grade?: Omit<NewGradeRecord, 'classId' | 'studentId'>
  errors: string[]
}

export interface GradeImportPreview { rows: GradeImportRow[]; validCount: number; errorCount: number }

/** Persistence boundary used by UI and workflows; callers never access Dexie. */
export interface ClassRepository {
  listClasses(includeArchived?: boolean): Promise<ClassRecord[]>
  getClass(id: EntityId): Promise<ClassRecord | undefined>
  createClass(input: NewClassRecord): Promise<ClassRecord>
  updateClass(id: EntityId, changes: ClassRecordChanges): Promise<ClassRecord>
  deleteClass(id: EntityId): Promise<void>

  listStudents(classId: EntityId, includeArchived?: boolean): Promise<StudentRecord[]>
  getStudent(id: EntityId): Promise<StudentRecord | undefined>
  createStudent(input: NewStudentRecord): Promise<StudentRecord>
  updateStudent(id: EntityId, changes: StudentRecordChanges): Promise<StudentRecord>
  deleteStudent(id: EntityId): Promise<void>

  getDraft(classId: EntityId): Promise<LayoutDraft | undefined>
  saveDraft(draft: LayoutDraft): Promise<void>
  deleteDraft(classId: EntityId): Promise<void>

  listGrades(classId: EntityId, filters?: { studentId?: EntityId; subject?: string; examDate?: string }): Promise<GradeRecord[]>
  createGrade(input: NewGradeRecord): Promise<GradeRecord>
  updateGrade(id: EntityId, changes: GradeRecordChanges): Promise<GradeRecord>
  deleteGrade(id: EntityId): Promise<void>
  importGrades(classId: EntityId, rows: readonly GradeImportRow[], strategy: GradeDuplicateStrategy): Promise<{ created: number; replaced: number; skipped: number }>
}
