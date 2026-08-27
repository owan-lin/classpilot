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

export interface SeatingSnapshot extends BaseRecord {
  classId: EntityId
  title: string
  note?: string
  effectiveAt: ISODateTime
  layout: LayoutDraft
  studentNames: Record<EntityId, string>
}

export interface BackupData {
  classes: ClassRecord[]
  students: StudentRecord[]
  drafts: LayoutDraft[]
  snapshots: SeatingSnapshot[]
}

export interface BackupEnvelope {
  format: 'classpilot-backup'
  schemaVersion: 2
  exportedAt: ISODateTime
  checksum: {
    algorithm: 'SHA-256'
    value: string
  }
  data: BackupData
}

export interface BackupRestoreResult {
  sourceSchemaVersion: 1 | 2
  counts: {
    classes: number
    students: number
    drafts: number
    snapshots: number
  }
}

export type NewClassRecord = Pick<ClassRecord, 'name' | 'grade' | 'academicYear'> &
  Partial<Pick<ClassRecord, 'archived'>>

export type ClassRecordChanges = Partial<
  Pick<ClassRecord, 'name' | 'grade' | 'academicYear' | 'archived'>
>

export type NewStudentRecord = Omit<StudentRecord, keyof BaseRecord>
export type StudentRecordChanges = Partial<
  Omit<StudentRecord, keyof BaseRecord | 'classId'>
>

export interface PublishSnapshotInput {
  classId: EntityId
  title: string
  note?: string
  effectiveAt?: ISODateTime
}

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
  listSnapshots(classId: EntityId): Promise<SeatingSnapshot[]>
  publishSnapshot(input: PublishSnapshotInput): Promise<SeatingSnapshot>
  restoreSnapshot(snapshotId: EntityId): Promise<LayoutDraft>

  exportBackup(): Promise<BackupEnvelope>
  restoreBackup(backup: unknown): Promise<BackupRestoreResult>
}
