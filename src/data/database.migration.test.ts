import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClassRecord, LayoutDraft, StudentRecord } from '../domain/types'
import { ClassPilotDatabase } from './database'

const databases: ClassPilotDatabase[] = []
const legacyDatabases: Dexie[] = []

const timestamp = '2026-08-28T00:00:00.000Z'

function oldStudent(classId: string): StudentRecord {
  return {
    id: 'student-old',
    classId,
    studentNo: '01',
    name: '旧数据库学生',
    gender: 'unspecified',
    roles: [],
    performanceLevel: 'good',
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
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function oldDraft(classId: string): LayoutDraft {
  return {
    id: 'draft-old',
    classId,
    podium: { x: 355, y: 22, width: 185, height: 58 },
    desks: [{
      id: 'desk-old',
      classId,
      kind: 'regular',
      capacity: 1,
      x: 75,
      y: 145,
      width: 190,
      height: 112,
      seatIds: ['seat-old'],
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    assignments: [{ seatId: 'seat-old', studentId: 'student-old' }],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function storeNames(name: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const names = Array.from(database.objectStoreNames)
      database.close()
      resolve(names)
    }
  })
}

afterEach(async () => {
  await Promise.all(legacyDatabases.splice(0).map(async (database) => {
    database.close()
    await database.delete()
  }))
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('ClassPilotDatabase v2 to v3 migration', () => {
  it('preserves core class/student/draft data and removes legacy snapshots store', async () => {
    const name = `classpilot-migration-${crypto.randomUUID()}`
    const classId = 'class-old'
    const classroom: ClassRecord = {
      id: classId,
      name: '旧版本班级',
      grade: '八年级',
      academicYear: '2026-2027',
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const student = oldStudent(classId)
    const draft = oldDraft(classId)

    const legacy = new Dexie(name)
    legacyDatabases.push(legacy)
    legacy.version(2).stores({
      classes: 'id, archived, updatedAt',
      students: 'id, classId, [classId+studentNo], archived, updatedAt',
      drafts: 'id, &classId, updatedAt',
      snapshots: 'id, classId, effectiveAt, createdAt',
      metadata: 'key',
    })
    await legacy.open()
    await legacy.table<ClassRecord>('classes').add(classroom)
    await legacy.table<StudentRecord>('students').add(student)
    await legacy.table<LayoutDraft>('drafts').add(draft)
    await legacy.table('snapshots').add({
      id: 'snapshot-old',
      classId,
      title: '历史快照（应移除）',
      effectiveAt: timestamp,
      layout: draft,
    })
    await legacy.table('metadata').add({ key: 'backup-imported-at', value: timestamp })
    legacy.close()

    const migrated = new ClassPilotDatabase(name)
    databases.push(migrated)
    await migrated.open()

    await expect(migrated.classes.get(classId)).resolves.toEqual(classroom)
    await expect(migrated.students.get(student.id)).resolves.toEqual(student)
    await expect(migrated.drafts.get(draft.id)).resolves.toEqual(draft)
    await expect(migrated.metadata.get('backup-imported-at')).resolves.toEqual({
      key: 'backup-imported-at',
      value: timestamp,
    })
    expect(await storeNames(name)).toEqual(expect.arrayContaining(['classes', 'students', 'drafts', 'metadata']))
    expect(await storeNames(name)).not.toContain('snapshots')
  })
})
