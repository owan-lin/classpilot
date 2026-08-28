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

})
