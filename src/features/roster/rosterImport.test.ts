import { Workbook } from 'exceljs'
import { describe, expect, it, vi } from 'vitest'
import type { StudentRecord } from '../../domain/types'
import { applyRosterImport, previewRosterWorkbook } from './rosterImport'

function existingStudent(): StudentRecord {
  return {
    id: 'student-existing',
    classId: 'class-a',
    studentNo: '01',
    name: '已有学生',
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

async function rosterBuffer(): Promise<ArrayBuffer> {
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('虚构名单')
  worksheet.addRow(['学号', '姓名', '性别', '职务', '学习水平'])
  worksheet.addRow(['01', '更新后的学生', '女', '班长', '优秀'])
  worksheet.addRow(['02', '新学生', '男', '', '良好'])
  worksheet.addRow(['02', '重复学生', '', '', ''])
  worksheet.addRow(['', '缺学号学生', '', '', ''])
  return workbook.xlsx.writeBuffer()
}

describe('Excel roster preview and import', () => {
  it('previews mapped rows and classifies both duplicate types', async () => {
    const preview = await previewRosterWorkbook(await rosterBuffer(), [existingStudent()])
    expect(preview.worksheetName).toBe('虚构名单')
    expect(preview.summary).toEqual({
      ready: 1,
      invalid: 1,
      'duplicate-existing': 1,
      'duplicate-workbook': 1,
    })
  })

  it('applies the selected update-existing policy only after preview', async () => {
    const preview = await previewRosterWorkbook(await rosterBuffer(), [existingStudent()])
    const repository = {
      createStudent: vi.fn(async (student) => ({ ...student, id: 'new', createdAt: '', updatedAt: '' })),
      updateStudent: vi.fn(async (id, changes) => ({ ...existingStudent(), ...changes, id })),
    }
    const result = await applyRosterImport(repository, 'class-a', preview, 'update-existing')
    expect(result).toEqual({ created: 1, updated: 1, skipped: 2 })
    expect(repository.updateStudent).toHaveBeenCalledWith(
      'student-existing',
      expect.objectContaining({ name: '更新后的学生' }),
    )
  })
})
