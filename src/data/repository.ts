import type {
  BackupEnvelope,
  BackupRestoreResult,
  ClassRecord,
  ClassRecordChanges,
  ClassRepository,
  EntityId,
  LayoutDraft,
  NewClassRecord,
  NewStudentRecord,
  PublishSnapshotInput,
  SeatingSnapshot,
  StudentRecord,
  StudentRecordChanges,
} from '../domain/types'
import { createBackup, validateAndMigrateBackup } from './backup'
import { ClassPilotDatabase } from './database'

export interface RepositoryDependencies {
  createId(): EntityId
  now(): string
}

const defaultDependencies: RepositoryDependencies = {
  createId: () => globalThis.crypto.randomUUID(),
  now: () => new Date().toISOString(),
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label}不能为空`)
  return trimmed
}

export function canonicalStudentNo(studentNo: string): string {
  return studentNo.trim().normalize('NFKC').toLowerCase()
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.normalize('NFKC').trim()).filter(Boolean))]
}

function normalizeStudent(input: NewStudentRecord): NewStudentRecord {
  return {
    ...clone(input),
    // 学号是辅助识别信息，不是录入学生的前置条件。
    studentNo: input.studentNo.trim().normalize('NFKC'),
    name: requireText(input.name, '姓名'),
    roles: uniqueText(input.roles),
    characterTags: uniqueText(input.characterTags),
    customTags: uniqueText(input.customTags),
    note: input.note.trim(),
    contact: {
      ...(input.contact.phone?.trim() ? { phone: input.contact.phone.trim() } : {}),
      ...(input.contact.address?.trim() ? { address: input.contact.address.trim() } : {}),
    },
    constraints: {
      ...clone(input.constraints),
      avoidAdjacentStudentIds: [...new Set(input.constraints.avoidAdjacentStudentIds)],
      preferredDeskMateStudentIds: [...new Set(input.constraints.preferredDeskMateStudentIds)],
    },
  }
}

async function requireRecord<T>(load: () => Promise<T | undefined>, label: string): Promise<T> {
  const record = await load()
  if (!record) throw new Error(`${label}不存在`)
  return record
}

export class DexieClassRepository implements ClassRepository {
  readonly database: ClassPilotDatabase
  private readonly dependencies: RepositoryDependencies

  constructor(
    database = new ClassPilotDatabase(),
    dependencies: RepositoryDependencies = defaultDependencies,
  ) {
    this.database = database
    this.dependencies = dependencies
  }

  async listClasses(includeArchived = false): Promise<ClassRecord[]> {
    let records = await this.database.classes.toArray()
    if (!includeArchived) records = records.filter(({ archived }) => !archived)
    return clone(records.sort((first, second) => first.name.localeCompare(second.name, 'zh-CN')))
  }

  async getClass(id: EntityId): Promise<ClassRecord | undefined> {
    const record = await this.database.classes.get(id)
    return record ? clone(record) : undefined
  }

  async createClass(input: NewClassRecord): Promise<ClassRecord> {
    const timestamp = this.dependencies.now()
    const record: ClassRecord = {
      id: this.dependencies.createId(),
      name: requireText(input.name, '班级名称'),
      grade: input.grade.trim(),
      academicYear: input.academicYear.trim(),
      archived: input.archived ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.database.classes.add(record)
    return clone(record)
  }

  async updateClass(id: EntityId, changes: ClassRecordChanges): Promise<ClassRecord> {
    return this.database.transaction('rw', this.database.classes, async () => {
      const current = await requireRecord(() => this.database.classes.get(id), '班级')
      const next: ClassRecord = {
        ...current,
        ...clone(changes),
        ...(changes.name === undefined ? {} : { name: requireText(changes.name, '班级名称') }),
        ...(changes.grade === undefined ? {} : { grade: changes.grade.trim() }),
        ...(changes.academicYear === undefined ? {} : { academicYear: changes.academicYear.trim() }),
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: this.dependencies.now(),
      }
      await this.database.classes.put(next)
      return clone(next)
    })
  }

  async deleteClass(id: EntityId): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.classes, this.database.students, this.database.drafts, this.database.snapshots],
      async () => {
        await this.database.students.where('classId').equals(id).delete()
        await this.database.drafts.where('classId').equals(id).delete()
        await this.database.snapshots.where('classId').equals(id).delete()
        await this.database.classes.delete(id)
      },
    )
  }

  async listStudents(classId: EntityId, includeArchived = false): Promise<StudentRecord[]> {
    let records = await this.database.students.where('classId').equals(classId).toArray()
    if (!includeArchived) records = records.filter(({ archived }) => !archived)
    return clone(
      records.sort((first, second) =>
        first.studentNo.localeCompare(second.studentNo, 'zh-CN', { numeric: true }),
      ),
    )
  }

  async getStudent(id: EntityId): Promise<StudentRecord | undefined> {
    const record = await this.database.students.get(id)
    return record ? clone(record) : undefined
  }

  private async assertStudentNoAvailable(
    classId: EntityId,
    studentNo: string,
    exceptId?: EntityId,
  ): Promise<void> {
    const normalized = canonicalStudentNo(studentNo)
    if (!normalized) return
    const classmates = await this.database.students.where('classId').equals(classId).toArray()
    if (classmates.some((student) => student.id !== exceptId && canonicalStudentNo(student.studentNo) === normalized)) {
      throw new Error(`学号 ${studentNo} 已存在`)
    }
  }

  async createStudent(input: NewStudentRecord): Promise<StudentRecord> {
    return this.database.transaction('rw', [this.database.classes, this.database.students], async () => {
      await requireRecord(() => this.database.classes.get(input.classId), '班级')
      const normalized = normalizeStudent(input)
      await this.assertStudentNoAvailable(input.classId, normalized.studentNo)
      const timestamp = this.dependencies.now()
      const record: StudentRecord = {
        ...normalized,
        id: this.dependencies.createId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await this.database.students.add(record)
      return clone(record)
    })
  }

  async updateStudent(id: EntityId, changes: StudentRecordChanges): Promise<StudentRecord> {
    return this.database.transaction('rw', [this.database.students, this.database.drafts], async () => {
      const current = await requireRecord(() => this.database.students.get(id), '学生')
      const merged = normalizeStudent({ ...current, ...clone(changes) })
      await this.assertStudentNoAvailable(current.classId, merged.studentNo, id)
      const next: StudentRecord = {
        ...merged,
        id: current.id,
        classId: current.classId,
        createdAt: current.createdAt,
        updatedAt: this.dependencies.now(),
      }
      await this.database.students.put(next)
      if (next.archived && !current.archived) {
        const draft = await this.database.drafts.where('classId').equals(current.classId).first()
        if (draft?.assignments.some(({ studentId }) => studentId === id)) {
          await this.database.drafts.put({
            ...draft,
            assignments: draft.assignments.filter(({ studentId }) => studentId !== id),
            updatedAt: this.dependencies.now(),
          })
        }
      }
      return clone(next)
    })
  }

  async deleteStudent(id: EntityId): Promise<void> {
    await this.database.transaction('rw', [this.database.students, this.database.drafts], async () => {
      const student = await this.database.students.get(id)
      if (!student) return
      await this.database.students.delete(id)
      const draft = await this.database.drafts.where('classId').equals(student.classId).first()
      if (draft?.assignments.some(({ studentId }) => studentId === id)) {
        await this.database.drafts.put({
          ...draft,
          assignments: draft.assignments.filter(({ studentId }) => studentId !== id),
          updatedAt: this.dependencies.now(),
        })
      }
    })
  }

  async getDraft(classId: EntityId): Promise<LayoutDraft | undefined> {
    const record = await this.database.drafts.where('classId').equals(classId).first()
    return record ? clone(record) : undefined
  }

  async saveDraft(draft: LayoutDraft): Promise<void> {
    await this.database.transaction('rw', [this.database.classes, this.database.students, this.database.drafts], async () => {
      await requireRecord(() => this.database.classes.get(draft.classId), '班级')
      const existing = await this.database.drafts.where('classId').equals(draft.classId).first()
      const seatIds = draft.desks.flatMap((desk) => desk.seatIds)
      if (new Set(draft.desks.map(({ id }) => id)).size !== draft.desks.length) {
        throw new Error('草稿包含重复课桌')
      }
      if (new Set(seatIds).size !== seatIds.length) throw new Error('草稿包含重复座位')
      if (draft.desks.some((desk) => desk.classId !== draft.classId)) {
        throw new Error('草稿课桌必须属于当前班级')
      }
      if (draft.desks.some((desk) => desk.seatIds.length !== desk.capacity)) {
        throw new Error('课桌容量与座位数量不一致')
      }
      if (new Set(draft.assignments.map(({ seatId }) => seatId)).size !== draft.assignments.length) {
        throw new Error('同一座位不能安排多个学生')
      }
      if (new Set(draft.assignments.map(({ studentId }) => studentId)).size !== draft.assignments.length) {
        throw new Error('同一学生不能安排到多个座位')
      }
      const validSeats = new Set(seatIds)
      if (draft.assignments.some(({ seatId }) => !validSeats.has(seatId))) throw new Error('草稿引用了不存在的座位')
      const classStudentIds = new Set(
        (await this.database.students.where('classId').equals(draft.classId).primaryKeys()).map(String),
      )
      if (draft.assignments.some(({ studentId }) => !classStudentIds.has(studentId))) {
        throw new Error('草稿引用了其他班级或不存在的学生')
      }
      const timestamp = this.dependencies.now()
      const record: LayoutDraft = {
        ...clone(draft),
        id: existing?.id ?? draft.id,
        createdAt: existing?.createdAt ?? draft.createdAt ?? timestamp,
        updatedAt: timestamp,
      }
      await this.database.drafts.put(record)
    })
  }

  async deleteDraft(classId: EntityId): Promise<void> {
    await this.database.drafts.where('classId').equals(classId).delete()
  }

  async listSnapshots(classId: EntityId): Promise<SeatingSnapshot[]> {
    const snapshots = await this.database.snapshots.where('classId').equals(classId).toArray()
    return clone(snapshots.sort((first, second) => second.effectiveAt.localeCompare(first.effectiveAt)))
  }

  async publishSnapshot(input: PublishSnapshotInput): Promise<SeatingSnapshot> {
    return this.database.transaction(
      'rw',
      [this.database.drafts, this.database.students, this.database.snapshots],
      async () => {
        const draft = await this.database.drafts.where('classId').equals(input.classId).first()
        if (!draft) throw new Error('尚未创建座位草稿')
        const students = await this.database.students.where('classId').equals(input.classId).toArray()
        const timestamp = this.dependencies.now()
        const assignedIds = new Set(draft.assignments.map(({ studentId }) => studentId))
        const snapshot: SeatingSnapshot = {
          id: this.dependencies.createId(),
          classId: input.classId,
          title: requireText(input.title, '版本标题'),
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
          effectiveAt: input.effectiveAt ?? timestamp,
          layout: clone(draft),
          studentNames: Object.fromEntries(
            students.filter(({ id }) => assignedIds.has(id)).map(({ id, name }) => [id, name]),
          ),
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        await this.database.snapshots.add(snapshot)
        return clone(snapshot)
      },
    )
  }

  async restoreSnapshot(snapshotId: EntityId): Promise<LayoutDraft> {
    return this.database.transaction('rw', [
      this.database.classes,
      this.database.students,
      this.database.snapshots,
      this.database.drafts,
    ], async () => {
      const snapshot = await requireRecord(() => this.database.snapshots.get(snapshotId), '历史版本')
      await requireRecord(() => this.database.classes.get(snapshot.classId), '班级')
      const activeStudentIds = new Set(
        (await this.database.students.where('classId').equals(snapshot.classId).toArray())
          .filter(({ archived }) => !archived)
          .map(({ id }) => id),
      )
      const validSeatIds = new Set(snapshot.layout.desks.flatMap((desk) => desk.seatIds))
      const assignedSeats = new Set<EntityId>()
      const assignedStudents = new Set<EntityId>()
      const assignments = snapshot.layout.assignments.filter((assignment) => {
        if (!validSeatIds.has(assignment.seatId) || !activeStudentIds.has(assignment.studentId)) return false
        if (assignedSeats.has(assignment.seatId) || assignedStudents.has(assignment.studentId)) return false
        assignedSeats.add(assignment.seatId)
        assignedStudents.add(assignment.studentId)
        return true
      })
      const timestamp = this.dependencies.now()
      const restored: LayoutDraft = {
        ...clone(snapshot.layout),
        id: this.dependencies.createId(),
        classId: snapshot.classId,
        assignments,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await this.database.drafts.where('classId').equals(snapshot.classId).delete()
      await this.database.drafts.add(restored)
      return clone(restored)
    })
  }

  async exportBackup(): Promise<BackupEnvelope> {
    const [classes, students, drafts, snapshots] = await this.database.transaction(
      'r',
      [this.database.classes, this.database.students, this.database.drafts, this.database.snapshots],
      () => Promise.all([
        this.database.classes.orderBy('id').toArray(),
        this.database.students.orderBy('id').toArray(),
        this.database.drafts.orderBy('id').toArray(),
        this.database.snapshots.orderBy('id').toArray(),
      ]),
    )
    return createBackup({ classes, students, drafts, snapshots }, this.dependencies.now())
  }

  async restoreBackup(input: unknown): Promise<BackupRestoreResult> {
    const { backup, sourceSchemaVersion } = await validateAndMigrateBackup(input)
    const { classes, students, drafts, snapshots } = backup.data
    await this.database.transaction(
      'rw',
      [this.database.classes, this.database.students, this.database.drafts, this.database.snapshots],
      async () => {
        await Promise.all([
          this.database.classes.clear(),
          this.database.students.clear(),
          this.database.drafts.clear(),
          this.database.snapshots.clear(),
        ])
        await this.database.classes.bulkPut(clone(classes))
        await this.database.students.bulkPut(clone(students))
        await this.database.drafts.bulkPut(clone(drafts))
        await this.database.snapshots.bulkPut(clone(snapshots))
      },
    )
    return {
      sourceSchemaVersion,
      counts: {
        classes: classes.length,
        students: students.length,
        drafts: drafts.length,
        snapshots: snapshots.length,
      },
    }
  }
}

export const classRepository: ClassRepository = new DexieClassRepository()
