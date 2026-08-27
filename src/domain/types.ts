export type EntityId = string
export type Gender = 'male' | 'female' | 'unspecified'
export type PerformanceLevel = 'excellent' | 'good' | 'average' | 'needs_support'
export type FrontPreference = 'none' | 'preferred' | 'required'

export interface BaseRecord {
  id: EntityId
  createdAt: string
  updatedAt: string
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
  effectiveAt: string
  layout: LayoutDraft
  studentNames: Record<EntityId, string>
}

export interface BackupEnvelope {
  schemaVersion: 1
  exportedAt: string
  checksum: string
  classes: ClassRecord[]
  students: StudentRecord[]
  drafts: LayoutDraft[]
  snapshots: SeatingSnapshot[]
}

export interface ClassRepository {
  listClasses(): Promise<ClassRecord[]>
  listStudents(classId: EntityId): Promise<StudentRecord[]>
  getDraft(classId: EntityId): Promise<LayoutDraft | undefined>
  saveDraft(draft: LayoutDraft): Promise<void>
  listSnapshots(classId: EntityId): Promise<SeatingSnapshot[]>
  exportBackup(): Promise<BackupEnvelope>
  restoreBackup(backup: BackupEnvelope): Promise<void>
}
