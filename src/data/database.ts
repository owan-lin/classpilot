import Dexie, { type EntityTable } from 'dexie'
import type { ClassRecord, GradeRecord, LayoutDraft, StudentRecord } from '../domain/types'

export interface DatabaseMetadata {
  key: string
  value: string
}

export const DATABASE_NAME = 'classpilot'
export const DATABASE_SCHEMA_VERSION = 4

export class ClassPilotDatabase extends Dexie {
  classes!: EntityTable<ClassRecord, 'id'>
  students!: EntityTable<StudentRecord, 'id'>
  drafts!: EntityTable<LayoutDraft, 'id'>
  grades!: EntityTable<GradeRecord, 'id'>
  metadata!: EntityTable<DatabaseMetadata, 'key'>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(1).stores({
      classes: 'id, archived, updatedAt',
      students: 'id, classId, archived, updatedAt',
      drafts: 'id, &classId, updatedAt',
      snapshots: 'id, classId, effectiveAt, createdAt',
    })

    this.version(2)
      .stores({
        classes: 'id, archived, updatedAt',
        students: 'id, classId, [classId+studentNo], archived, updatedAt',
        drafts: 'id, &classId, updatedAt',
        snapshots: 'id, classId, effectiveAt, createdAt',
        metadata: 'key',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<StudentRecord>('students')
          .toCollection()
          .modify((student) => {
            student.roles ??= []
            student.characterTags ??= []
            student.customTags ??= []
            student.note ??= ''
            student.contact ??= {}
            student.constraints ??= {
              frontPreference: 'none',
              avoidAdjacentStudentIds: [],
              preferredDeskMateStudentIds: [],
            }
            student.constraints.avoidAdjacentStudentIds ??= []
            student.constraints.preferredDeskMateStudentIds ??= []
          })
        await transaction.table<DatabaseMetadata>('metadata').put({
          key: 'schema-migrated-at',
          value: new Date().toISOString(),
        })
      })

    // Historical snapshots were never part of the core classroom workflow.
    // Drop the legacy object store while preserving classes, students and drafts.
    this.version(DATABASE_SCHEMA_VERSION).stores({
      classes: 'id, archived, updatedAt',
      students: 'id, classId, [classId+studentNo], archived, updatedAt',
      drafts: 'id, &classId, updatedAt',
      snapshots: null,
      metadata: 'key',
    })

    this.version(DATABASE_SCHEMA_VERSION)
      .stores({
        classes: 'id, archived, updatedAt',
        students: 'id, classId, [classId+studentNo], archived, updatedAt',
        drafts: 'id, &classId, updatedAt',
        snapshots: null,
        grades: 'id, classId, studentId, [studentId+subject+examDate], examDate, updatedAt',
        metadata: 'key',
      })
      .upgrade(async (transaction) => {
        await transaction.table<ClassRecord>('classes').toCollection().modify((classroom) => {
          classroom.plannedStudentCount ??= 0
          classroom.rows ??= 2
          classroom.desksPerRow ??= 3
          classroom.deskCapacity ??= 2
        })
      })
  }
}
