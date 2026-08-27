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
      expect(restored.classes).toHaveLength(exported.classes.length)
      expect(restored.students).toHaveLength(exported.students.length)
      expect(restored.drafts).toHaveLength(exported.drafts.length)
      expect(restored.snapshots).toHaveLength(exported.snapshots.length)
      expect(restored.classes).toEqual(expect.arrayContaining(exported.classes))
      expect(restored.students).toEqual(expect.arrayContaining(exported.students))
      expect(restored.drafts).toEqual(expect.arrayContaining(exported.drafts))
      expect(restored.snapshots).toEqual(expect.arrayContaining(exported.snapshots))
    })
  })
}
