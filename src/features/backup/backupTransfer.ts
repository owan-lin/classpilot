import type { BackupEnvelope, ClassRepository } from '../../domain/types'
import { validateAndMigrateBackup } from '../../data/backup'

export const BACKUP_FILE_EXTENSION = '.classpilot.json'
export const BACKUP_PRIVACY_WARNING =
  '完整备份可能包含学生联系电话和住址。请仅保存在受保护的设备或加密存储中，不要上传到公开平台。'

export function serializeBackup(backup: BackupEnvelope): string {
  return JSON.stringify(backup, null, 2)
}

export async function parseBackupText(contents: string): Promise<BackupEnvelope> {
  let input: unknown
  try {
    input = JSON.parse(contents)
  } catch (error) {
    throw new Error('备份文件不是有效的 JSON', { cause: error })
  }
  return (await validateAndMigrateBackup(input)).backup
}

export async function createBackupDownload(
  repository: Pick<ClassRepository, 'exportBackup'>,
): Promise<{ filename: string; blob: Blob; warning: string }> {
  const backup = await repository.exportBackup()
  const date = backup.exportedAt.slice(0, 10)
  return {
    filename: `classpilot-backup-${date}${BACKUP_FILE_EXTENSION}`,
    blob: new Blob([serializeBackup(backup)], { type: 'application/json;charset=utf-8' }),
    warning: BACKUP_PRIVACY_WARNING,
  }
}

export async function restoreBackupText(
  repository: Pick<ClassRepository, 'restoreBackup'>,
  contents: string,
) {
  const backup = await parseBackupText(contents)
  return repository.restoreBackup(backup)
}
