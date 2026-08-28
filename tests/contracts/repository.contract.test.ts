import { afterEach, describe, expect, it } from 'vitest'
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

})
