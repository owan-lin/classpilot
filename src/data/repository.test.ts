import { afterEach, describe, expect, it } from 'vitest'
import type { LayoutDraft, NewStudentRecord } from '../domain/types'
import { ClassPilotDatabase } from './database'
import { DexieClassRepository } from './repository'

const databases: ClassPilotDatabase[] = []

function createRepository() {
  const database = new ClassPilotDatabase(`classpilot-test-${crypto.randomUUID()}`)
  databases.push(database)
  let sequence = 0
  const repository = new DexieClassRepository(database, {
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    now: () => `2026-08-27T00:00:${String(sequence).padStart(2, '0')}.000Z`,
  })
  return { database, repository }
}

function newStudent(classId: string, studentNo = '01'): NewStudentRecord {
  return {
    classId,
    studentNo,
    name: '测试学生甲',
    gender: 'unspecified',
    roles: [],
    performanceLevel: 'average',
    characterTags: [],
    customTags: [],
    note: '',
    contact: {},
    constraints: {
      frontPreference: 'none',
      avoidAdjacentStudentIds: [],
      preferredDeskMateStudentIds: [],
    },
    archived: false,
  }
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('DexieClassRepository', () => {
  it('supports class and student CRUD while rejecting duplicate student numbers', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '测试班', grade: '八年级', academicYear: '2026-2027' })
    const student = await repository.createStudent(newStudent(classroom.id, ' ０１ '))
    expect(student.studentNo).toBe('01')
    await expect(repository.createStudent(newStudent(classroom.id, '01'))).rejects.toThrow('已存在')

    const updated = await repository.updateStudent(student.id, { name: '测试学生乙' })
    expect(updated.name).toBe('测试学生乙')
    expect(await repository.listStudents(classroom.id)).toHaveLength(1)
    await repository.deleteStudent(student.id)
    expect(await repository.listStudents(classroom.id)).toEqual([])
  })

  it('keeps published snapshots immutable and restores one as a new draft', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '快照测试班', grade: '', academicYear: '' })
    const student = await repository.createStudent(newStudent(classroom.id))
    const draft: LayoutDraft = {
      id: crypto.randomUUID(),
      classId: classroom.id,
      podium: { x: 0, y: 0, width: 100, height: 50 },
      desks: [{
        id: crypto.randomUUID(),
        classId: classroom.id,
        kind: 'regular',
        capacity: 1,
        x: 0,
        y: 100,
        width: 100,
        height: 60,
        seatIds: ['seat-a'],
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
      }],
      assignments: [{ seatId: 'seat-a', studentId: student.id }],
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
    }
    await repository.saveDraft(draft)
    const snapshot = await repository.publishSnapshot({ classId: classroom.id, title: '第一版' })
    await repository.saveDraft({ ...draft, assignments: [] })

    expect((await repository.listSnapshots(classroom.id))[0].layout.assignments).toHaveLength(1)
    const restored = await repository.restoreSnapshot(snapshot.id)
    expect(restored.id).not.toBe(snapshot.layout.id)
    expect(restored.assignments).toEqual(snapshot.layout.assignments)
  })

  it('keeps a restored draft valid when a snapshot student was later archived', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '归档快照测试班', grade: '', academicYear: '' })
    const student = await repository.createStudent(newStudent(classroom.id))
    const draft: LayoutDraft = {
      id: crypto.randomUUID(),
      classId: classroom.id,
      podium: { x: 0, y: 0, width: 100, height: 50 },
      desks: [{
        id: crypto.randomUUID(),
        classId: classroom.id,
        kind: 'regular',
        capacity: 1,
        x: 0,
        y: 100,
        width: 100,
        height: 60,
        seatIds: ['seat-a'],
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
      }],
      assignments: [{ seatId: 'seat-a', studentId: student.id }],
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
    }
    await repository.saveDraft(draft)
    const snapshot = await repository.publishSnapshot({ classId: classroom.id, title: '归档前' })
    await repository.updateStudent(student.id, { archived: true })

    expect((await repository.getDraft(classroom.id))?.assignments).toEqual([])
    const restored = await repository.restoreSnapshot(snapshot.id)
    expect(restored.assignments).toEqual([])
    expect((await repository.listSnapshots(classroom.id))[0].layout.assignments).toHaveLength(1)
  })

  it('rejects drafts with foreign or malformed desks before persisting', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '草稿校验班', grade: '', academicYear: '' })
    const malformed: LayoutDraft = {
      id: crypto.randomUUID(),
      classId: classroom.id,
      podium: { x: 0, y: 0, width: 100, height: 50 },
      desks: [{
        id: crypto.randomUUID(),
        classId: 'other-class',
        kind: 'regular',
        capacity: 2,
        x: 0,
        y: 100,
        width: 100,
        height: 60,
        seatIds: ['seat-a'],
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
      }],
      assignments: [],
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
    }
    await expect(repository.saveDraft(malformed)).rejects.toThrow('当前班级')

    await expect(repository.saveDraft({
      ...malformed,
      desks: [{ ...malformed.desks[0], classId: classroom.id }],
    })).rejects.toThrow('容量')
  })

  it('exports and restores a validated cross-device backup', async () => {
    const source = createRepository().repository
    const classroom = await source.createClass({ name: '备份测试班', grade: '', academicYear: '' })
    await source.createStudent(newStudent(classroom.id))
    const backup = await source.exportBackup()

    const destination = createRepository().repository
    const result = await destination.restoreBackup(backup)
    expect(result.counts).toEqual({ classes: 1, students: 1, drafts: 0, snapshots: 0 })
    expect((await destination.listClasses())[0].name).toBe('备份测试班')
  })
})
