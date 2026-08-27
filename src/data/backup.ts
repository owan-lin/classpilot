import { z } from 'zod'
import type { BackupData, BackupEnvelope } from '../domain/types'

export const BACKUP_FORMAT = 'classpilot-backup'
export const BACKUP_SCHEMA_VERSION = 2

export class BackupValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'BackupValidationError'
  }
}

const isoDateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), '无效的 ISO 日期')
const entityId = z.string().min(1)
const baseRecord = {
  id: entityId,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}
const constraintsSchema = z.object({
  frontPreference: z.enum(['none', 'preferred', 'required']),
  avoidAdjacentStudentIds: z.array(entityId),
  preferredDeskMateStudentIds: z.array(entityId),
})
const classSchema = z.object({
  ...baseRecord,
  name: z.string().min(1),
  grade: z.string(),
  academicYear: z.string(),
  archived: z.boolean(),
})
const studentSchema = z.object({
  ...baseRecord,
  classId: entityId,
  studentNo: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(['male', 'female', 'unspecified']),
  roles: z.array(z.string()),
  performanceLevel: z.enum(['excellent', 'good', 'average', 'needs_support']),
  rank: z.number().int().positive().optional(),
  characterTags: z.array(z.string()),
  customTags: z.array(z.string()),
  note: z.string(),
  contact: z.object({ phone: z.string().optional(), address: z.string().optional() }),
  constraints: constraintsSchema,
  archived: z.boolean(),
})
const deskSchema = z.object({
  ...baseRecord,
  classId: entityId,
  kind: z.enum(['regular', 'special']),
  capacity: z.union([z.literal(1), z.literal(2)]),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  seatIds: z.array(entityId).min(1).max(2),
})
const assignmentSchema = z.object({ seatId: entityId, studentId: entityId })
const layoutSchema = z.object({
  ...baseRecord,
  classId: entityId,
  podium: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  desks: z.array(deskSchema),
  assignments: z.array(assignmentSchema),
})
const snapshotSchema = z.object({
  ...baseRecord,
  classId: entityId,
  title: z.string().min(1),
  note: z.string().optional(),
  effectiveAt: isoDateTime,
  layout: layoutSchema,
  studentNames: z.record(entityId, z.string()),
})
const backupDataSchema = z.object({
  classes: z.array(classSchema),
  students: z.array(studentSchema),
  drafts: z.array(layoutSchema),
  snapshots: z.array(snapshotSchema),
})
const v2EnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: isoDateTime,
  checksum: z.object({
    algorithm: z.literal('SHA-256'),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  data: backupDataSchema,
})
const v1EnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: isoDateTime,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  classes: z.array(classSchema),
  students: z.array(studentSchema),
  drafts: z.array(layoutSchema),
  snapshots: z.array(snapshotSchema),
})

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export async function checksumBackupData(data: BackupData): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new BackupValidationError('当前环境不支持 SHA-256 校验')
  const encoded = new TextEncoder().encode(canonicalize(data))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new BackupValidationError(`${label}包含重复 ID`)
}

function validateLayout(
  layout: z.infer<typeof layoutSchema>,
  classIds: ReadonlySet<string>,
  studentClassById: ReadonlyMap<string, string>,
): void {
  if (!classIds.has(layout.classId)) throw new BackupValidationError('座位草稿引用了不存在的班级')
  const seatIds = layout.desks.flatMap((desk) => desk.seatIds)
  assertUnique(layout.desks.map((desk) => desk.id), '课桌')
  assertUnique(seatIds, '座位')
  assertUnique(layout.assignments.map((assignment) => assignment.seatId), '占用座位')
  assertUnique(layout.assignments.map((assignment) => assignment.studentId), '已安排学生')

  const knownSeats = new Set(seatIds)
  for (const desk of layout.desks) {
    if (desk.classId !== layout.classId) throw new BackupValidationError('课桌与草稿班级不一致')
    if (desk.seatIds.length !== desk.capacity) throw new BackupValidationError('课桌容量与座位数量不一致')
  }
  for (const assignment of layout.assignments) {
    if (!knownSeats.has(assignment.seatId)) throw new BackupValidationError('座位安排引用了不存在的座位')
    if (studentClassById.get(assignment.studentId) !== layout.classId) {
      throw new BackupValidationError('座位安排引用了其他班级或不存在的学生')
    }
  }
}

function validateReferences(data: BackupData): void {
  assertUnique(data.classes.map(({ id }) => id), '班级')
  assertUnique(data.students.map(({ id }) => id), '学生')
  assertUnique(data.drafts.map(({ id }) => id), '草稿')
  assertUnique(data.drafts.map(({ classId }) => classId), '班级草稿')
  assertUnique(data.snapshots.map(({ id }) => id), '历史快照')

  const classIds = new Set(data.classes.map(({ id }) => id))
  const studentClassById = new Map(data.students.map(({ id, classId }) => [id, classId]))
  const studentNumbers = new Set<string>()
  for (const student of data.students) {
    if (!classIds.has(student.classId)) throw new BackupValidationError('学生引用了不存在的班级')
    const key = `${student.classId}\u0000${student.studentNo.normalize('NFKC').trim().toLowerCase()}`
    if (studentNumbers.has(key)) throw new BackupValidationError('同一班级存在重复学号')
    studentNumbers.add(key)
  }
  for (const draft of data.drafts) validateLayout(draft, classIds, studentClassById)
  for (const snapshot of data.snapshots) {
    if (snapshot.layout.classId !== snapshot.classId) throw new BackupValidationError('历史快照班级不一致')
    validateLayout(snapshot.layout, classIds, studentClassById)
  }
}

export async function createBackup(
  data: BackupData,
  exportedAt = new Date().toISOString(),
): Promise<BackupEnvelope> {
  const parsed = backupDataSchema.parse(structuredClone(data)) as BackupData
  validateReferences(parsed)
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    checksum: { algorithm: 'SHA-256', value: await checksumBackupData(parsed) },
    data: parsed,
  }
}

export interface ValidatedBackup {
  backup: BackupEnvelope
  sourceSchemaVersion: 1 | 2
}

export async function validateAndMigrateBackup(input: unknown): Promise<ValidatedBackup> {
  try {
    const version = z.object({ schemaVersion: z.number().int() }).passthrough().parse(input).schemaVersion
    if (version === BACKUP_SCHEMA_VERSION) {
      const backup = v2EnvelopeSchema.parse(input) as BackupEnvelope
      validateReferences(backup.data)
      const checksum = await checksumBackupData(backup.data)
      if (checksum !== backup.checksum.value) throw new BackupValidationError('备份校验和不匹配，文件可能已损坏')
      return { backup: structuredClone(backup), sourceSchemaVersion: 2 }
    }
    if (version === 1) {
      const legacy = v1EnvelopeSchema.parse(input)
      const data = {
        classes: legacy.classes,
        students: legacy.students,
        drafts: legacy.drafts,
        snapshots: legacy.snapshots,
      } as BackupData
      validateReferences(data)
      const checksum = await checksumBackupData(data)
      if (checksum !== legacy.checksum) throw new BackupValidationError('旧版备份校验和不匹配')
      return {
        backup: {
          format: BACKUP_FORMAT,
          schemaVersion: BACKUP_SCHEMA_VERSION,
          exportedAt: legacy.exportedAt,
          checksum: { algorithm: 'SHA-256', value: checksum },
          data,
        },
        sourceSchemaVersion: 1,
      }
    }
    throw new BackupValidationError(`不支持的备份版本：${version}`)
  } catch (error) {
    if (error instanceof BackupValidationError) throw error
    if (error instanceof z.ZodError) {
      throw new BackupValidationError(`备份结构无效：${error.issues[0]?.message ?? '未知错误'}`, { cause: error })
    }
    throw new BackupValidationError('无法读取备份文件', { cause: error })
  }
}
