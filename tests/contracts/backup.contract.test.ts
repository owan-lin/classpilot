import fc from 'fast-check'
import { afterEach, describe, expect, it } from 'vitest'
import { createBackup } from '../../src/data/backup'
import { createDefaultDraft } from '../../src/features/drafts/createDraft'
import { parseBackupText, serializeBackup } from '../../src/features/backup/backupTransfer'
import { backupDataArbitrary } from '../fixtures/classroom'
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

describe('backup contracts', () => {
  it('round-trips complete fictional v2 backups through text serialization', async () => {
    await fc.assert(fc.asyncProperty(backupDataArbitrary, async (data) => {
      const backup = await createBackup(data, '2026-08-27T00:00:00.000Z')
      await expect(parseBackupText(serializeBackup(backup))).resolves.toEqual(backup)
    }), { numRuns: 100 })
  })

  it('restores a complete backup between independent local repositories', async () => {
    const source = createRepositoryFixture().repository
    const classroom = await source.createClass({ name: '跨端虚构班级', grade: '测试年级', academicYear: '2026-2027' })
    const student = await source.createStudent(newTestStudent(classroom.id))
    const draft = createDefaultDraft(classroom.id, {
      createId: (() => {
        let sequence = 0
        return () => `draft-${++sequence}`
      })(),
      now: () => '2026-08-27T00:00:00.000Z',
    })
    draft.assignments = [{ seatId: draft.desks[0].seatIds[0], studentId: student.id }]
    await source.saveDraft(draft)
    await source.publishSnapshot({ classId: classroom.id, title: '虚构历史版本' })
    const exported = await source.exportBackup()

    const destination = createRepositoryFixture().repository
    await expect(destination.restoreBackup(exported)).resolves.toMatchObject({
      sourceSchemaVersion: 2,
      counts: { classes: 1, students: 1, drafts: 1, snapshots: 1 },
    })
    expect((await destination.exportBackup()).data).toEqual(exported.data)
  })
})
