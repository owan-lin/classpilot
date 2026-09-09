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
  it('stores class layout parameters and validates score records', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '参数班', grade: '七年级', academicYear: '2026', plannedStudentCount: 12, rows: 2, desksPerRow: 3, deskCapacity: 2 })
    expect(classroom).toMatchObject({ plannedStudentCount: 12, rows: 2, desksPerRow: 3, deskCapacity: 2 })
    const student = await repository.createStudent(newStudent(classroom.id))
    await expect(repository.createGrade({ classId: classroom.id, studentId: student.id, subject: '数学', examName: '月考', examDate: '2026-01-01', score: 101, fullScore: 100 })).rejects.toThrow('得分')
    const grade = await repository.createGrade({ classId: classroom.id, studentId: student.id, subject: '数学', examName: '月考', examDate: '2026-01-01', score: 80, fullScore: 100 })
    expect(await repository.listGrades(classroom.id, { studentId: student.id })).toEqual([grade])
  })

  it('imports grades atomically and applies duplicate strategies', async () => {
    const { repository } = createRepository(); const classroom = await repository.createClass({ name: '导入班', grade: '', academicYear: '' }); const student = await repository.createStudent(newStudent(classroom.id, '01'))
    const row = { rowNumber: 2, raw: {}, studentNo: '01', errors: [], grade: { subject: '数学', examName: '月考', examDate: '2026-01-01', score: 90, fullScore: 100 } }
    await expect(repository.importGrades(classroom.id, [row], 'reject')).resolves.toEqual({ created: 1, replaced: 0, skipped: 0 })
    await expect(repository.importGrades(classroom.id, [row], 'skip')).resolves.toEqual({ created: 0, replaced: 0, skipped: 1 })
    await expect(repository.importGrades(classroom.id, [{ ...row, grade: { ...row.grade, score: 95 } }], 'replace')).resolves.toEqual({ created: 0, replaced: 1, skipped: 0 })
    expect((await repository.listGrades(classroom.id))[0]).toMatchObject({ studentId: student.id, score: 95 })
  })
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

  it('does not let a draft ID from one class overwrite another class draft', async () => {
    const { repository } = createRepository()
    const first = await repository.createClass({ name: '甲班', grade: '', academicYear: '' })
    const second = await repository.createClass({ name: '乙班', grade: '', academicYear: '' })
    const firstDraft: LayoutDraft = {
      id: 'shared-draft-id', classId: first.id,
      podium: { x: 0, y: 0, width: 100, height: 50 }, desks: [], assignments: [],
      createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
    }
    await repository.saveDraft(firstDraft)
    await expect(repository.saveDraft({ ...firstDraft, classId: second.id })).rejects.toThrow('其他班级')
    await expect(repository.getDraft(first.id)).resolves.toMatchObject({ classId: first.id, id: firstDraft.id })
    await expect(repository.getDraft(second.id)).resolves.toBeUndefined()
  })

  it('cleans a deleted student from classmates, drafts, and grades atomically', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '关联清理班', grade: '', academicYear: '' })
    const removed = await repository.createStudent(newStudent(classroom.id, '01'))
    const classmate = await repository.createStudent({ ...newStudent(classroom.id, '02'), constraints: {
      frontPreference: 'none', avoidAdjacentStudentIds: [removed.id], preferredDeskMateStudentIds: [removed.id],
    } })
    await repository.createGrade({ classId: classroom.id, studentId: removed.id, subject: '数学', examName: '月考', examDate: '2026-02-28', score: 80, fullScore: 100 })
    await repository.deleteStudent(removed.id)
    expect(await repository.listGrades(classroom.id)).toEqual([])
    await expect(repository.getStudent(classmate.id)).resolves.toMatchObject({ constraints: {
      avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [],
    } })
  })

  it('rejects impossible ISO calendar dates', async () => {
    const { repository } = createRepository()
    const classroom = await repository.createClass({ name: '日期班', grade: '', academicYear: '' })
    const student = await repository.createStudent(newStudent(classroom.id))
    await expect(repository.createGrade({ classId: classroom.id, studentId: student.id, subject: '数学', examName: '测验', examDate: '2026-02-29', score: 80, fullScore: 100 })).rejects.toThrow('ISO 日期')
  })

})
