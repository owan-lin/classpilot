import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultDraft } from '../../src/features/drafts/createDraft'
import {
  createTestRepository,
  disposeTestRepository,
  newTestStudent,
  type TestRepositoryFixture,
} from '../fixtures/repository'

const repositories: TestRepositoryFixture[] = []

function createRepositoryFixture() {
  const fixture = createTestRepository()
  repositories.push(fixture)
  return fixture
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map(disposeTestRepository))
})

describe('repository workflows', () => {
  it('rejects canonical duplicate student numbers only within the same class', async () => {
    const repository = createRepositoryFixture().repository
    const firstClass = await repository.createClass({ name: '甲班', grade: '', academicYear: '' })
    const secondClass = await repository.createClass({ name: '乙班', grade: '', academicYear: '' })
    const firstStudent = await repository.createStudent(newTestStudent(firstClass.id, ' ０１ '))

    await expect(repository.createStudent(newTestStudent(firstClass.id, '01'))).rejects.toThrow('已存在')
    await expect(repository.updateStudent(firstStudent.id, { studentNo: ' ０１ ' })).resolves.toMatchObject({ studentNo: '01' })
    await expect(repository.createStudent(newTestStudent(secondClass.id, '01'))).resolves.toMatchObject({ studentNo: '01' })
  })

  it('supports an empty class and restores a published snapshot as a new draft', async () => {
    const repository = createRepositoryFixture().repository
    const classroom = await repository.createClass({ name: '空班测试', grade: '', academicYear: '' })
    const draft = createDefaultDraft(classroom.id, {
      createId: (() => {
        let sequence = 0
        return () => `empty-${++sequence}`
      })(),
      now: () => '2026-08-27T00:00:00.000Z',
    })
    await repository.saveDraft(draft)
    const snapshot = await repository.publishSnapshot({ classId: classroom.id, title: '空班历史' })
    await repository.saveDraft({ ...draft, assignments: [] })

    expect(await repository.listStudents(classroom.id)).toEqual([])
    const restored = await repository.restoreSnapshot(snapshot.id)
    expect(restored.id).not.toBe(snapshot.layout.id)
    expect(restored.assignments).toEqual([])
    expect((await repository.listSnapshots(classroom.id))[0]).toEqual(snapshot)
  })
})
