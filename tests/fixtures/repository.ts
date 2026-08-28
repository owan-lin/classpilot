import type { NewStudentRecord } from '../../src/domain/types'
import { ClassPilotDatabase } from '../../src/data/database'
import { DexieClassRepository } from '../../src/data/repository'

export interface TestRepositoryFixture {
  database: ClassPilotDatabase
  repository: DexieClassRepository
}

export function createTestRepository(): TestRepositoryFixture {
  const database = new ClassPilotDatabase(`classpilot-qa-${crypto.randomUUID()}`)
  let sequence = 0
  const repository = new DexieClassRepository(database, {
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    now: () => `2026-08-27T00:00:${String(sequence).padStart(2, '0')}.000Z`,
  })
  return { database, repository }
}

export async function disposeTestRepository(fixture: TestRepositoryFixture): Promise<void> {
  await fixture.database.delete()
}

export function newTestStudent(classId: string, studentNo = '01'): NewStudentRecord {
  return {
    classId,
    studentNo,
    name: `虚构学生 ${studentNo}`,
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
