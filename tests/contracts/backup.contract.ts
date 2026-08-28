import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { BackupEnvelope, ClassRepository } from '../../src/domain/types'
import { backupEnvelopeArbitrary } from '../fixtures/classroom'

export interface BackupCodecContract {
  decodeBackup(encoded: string): BackupEnvelope
  encodeBackup(backup: BackupEnvelope): string
}

export interface CrossTargetRepositoryPair {
  source: ClassRepository
  target: ClassRepository
}

export function defineBackupCodecContract(createCodec: () => BackupCodecContract) {
  describe('backup codec properties', () => {
    it('round-trips a complete fictional backup without data loss', () => {
      fc.assert(fc.property(backupEnvelopeArbitrary, (backup) => {
        const codec = createCodec()
        expect(codec.decodeBackup(codec.encodeBackup(backup))).toEqual(backup)
      }), { numRuns: 200 })
    })
  })
}

export function defineCrossTargetBackupContract(
  createRepositories: () => Promise<CrossTargetRepositoryPair>,
) {
  describe('cross-target backup portability', () => {
    it('restores all classroom records exported by an independent source', async () => {
      const { source, target } = await createRepositories()
      const exported = await source.exportBackup()

      await target.restoreBackup(exported)
      const restored = await target.exportBackup()

      expect(restored.schemaVersion).toBe(exported.schemaVersion)
      expect(restored.data.classes).toHaveLength(exported.data.classes.length)
      expect(restored.data.students).toHaveLength(exported.data.students.length)
      expect(restored.data.drafts).toHaveLength(exported.data.drafts.length)
      expect(restored.data.snapshots).toHaveLength(exported.data.snapshots.length)
      expect(restored.data.classes).toEqual(expect.arrayContaining(exported.data.classes))
      expect(restored.data.students).toEqual(expect.arrayContaining(exported.data.students))
      expect(restored.data.drafts).toEqual(expect.arrayContaining(exported.data.drafts))
      expect(restored.data.snapshots).toEqual(expect.arrayContaining(exported.data.snapshots))
    })
  })
}
