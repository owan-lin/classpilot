import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BackupData, ClassRecord } from '../domain/types'
import {
  BackupValidationError,
  checksumBackupData,
  createBackup,
  validateAndMigrateBackup,
} from './backup'

function emptyData(classes: ClassRecord[] = []): BackupData {
  return { classes, students: [], drafts: [], snapshots: [] }
}

describe('versioned backups', () => {
  it('round-trips every valid empty-class payload with a matching checksum', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.uuid(), { maxLength: 15 }),
        async (ids) => {
          const classes = ids.map((id, index): ClassRecord => ({
            id,
            name: `虚构班级 ${index + 1}`,
            grade: '八年级',
            academicYear: '2026-2027',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }))
          const data = emptyData(classes)
          const envelope = await createBackup(data, '2026-08-27T00:00:00.000Z')
          expect((await validateAndMigrateBackup(envelope)).backup.data).toEqual(data)
        },
      ),
      { numRuns: 30 },
    )
  })

  it('rejects a structurally valid backup after payload tampering', async () => {
    const backup = await createBackup(emptyData(), '2026-08-27T00:00:00.000Z')
    backup.data.classes.push({
      id: crypto.randomUUID(),
      name: '虚构班级',
      grade: '',
      academicYear: '',
      archived: false,
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
    })
    await expect(validateAndMigrateBackup(backup)).rejects.toBeInstanceOf(BackupValidationError)
  })

  it('migrates the supported v1 envelope into v2', async () => {
    const data = emptyData()
    const checksum = await checksumBackupData(data)
    const result = await validateAndMigrateBackup({
      schemaVersion: 1,
      exportedAt: '2026-08-27T00:00:00.000Z',
      checksum,
      ...data,
    })
    expect(result.sourceSchemaVersion).toBe(1)
    expect(result.backup.schemaVersion).toBe(2)
  })
})
