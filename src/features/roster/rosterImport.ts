import { Workbook, type CellValue, type Row } from 'exceljs'
import type {
  ClassRepository,
  Gender,
  NewStudentRecord,
  PerformanceLevel,
  StudentRecord,
  StudentRecordChanges,
} from '../../domain/types'
import { canonicalStudentNo } from '../../data/repository'

export type RosterField =
  | 'studentNo'
  | 'name'
  | 'gender'
  | 'roles'
  | 'performanceLevel'
  | 'rank'
  | 'characterTags'
  | 'note'
  | 'phone'
  | 'address'

export type RosterRowStatus =
  | 'ready'
  | 'invalid'
  | 'duplicate-existing'
  | 'duplicate-workbook'

export interface RosterPreviewRow {
  rowNumber: number
  status: RosterRowStatus
  errors: string[]
  existingStudentId?: string
  student: Omit<NewStudentRecord, 'classId'>
}

export interface RosterImportPreview {
  worksheetName: string
  headerRowNumber: number
  columns: Partial<Record<RosterField, number>>
  rows: RosterPreviewRow[]
  summary: Record<RosterRowStatus, number>
}

export type DuplicateStudentNoStrategy = 'reject' | 'skip' | 'update-existing'

export interface RosterImportResult {
  created: number
  updated: number
  skipped: number
}

const headerAliases: Record<RosterField, readonly string[]> = {
  studentNo: ['学号', '学生编号', '编号', 'studentno', 'studentnumber', 'no'],
  name: ['姓名', '名字', '学生姓名', 'name', 'studentname'],
  gender: ['性别', 'gender', 'sex'],
  roles: ['职务', '角色', '班级职务', 'roles', 'role'],
  performanceLevel: ['学习水平', '成绩水平', '学业水平', 'performance', 'level'],
  rank: ['排名', '名次', 'rank'],
  characterTags: ['性格标签', '标签', '特点', 'tags', 'character'],
  note: ['备注', '说明', 'note', 'notes'],
  phone: ['电话', '联系电话', '手机号', 'phone', 'mobile'],
  address: ['地址', '住址', 'address'],
}

function normalizedHeader(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map(({ text }) => text).join('')
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) return cellText(value.result as CellValue)
    return ''
  }
  return String(value).normalize('NFKC').trim()
}

function splitValues(value: string): string[] {
  return [...new Set(value.split(/[,，、;；|]/).map((part) => part.trim()).filter(Boolean))]
}

function parseGender(value: string): Gender {
  const normalized = normalizedHeader(value)
  if (['男', 'male', 'm'].includes(normalized)) return 'male'
  if (['女', 'female', 'f'].includes(normalized)) return 'female'
  return 'unspecified'
}

function parsePerformance(value: string): PerformanceLevel {
  const normalized = normalizedHeader(value)
  if (['优秀', '优', 'excellent'].includes(normalized)) return 'excellent'
  if (['良好', '良', 'good'].includes(normalized)) return 'good'
  if (['需支持', '待提升', 'needsupport', 'needs_support'].includes(normalized)) return 'needs_support'
  return 'average'
}

function getColumns(row: Row): Partial<Record<RosterField, number>> {
  const columns: Partial<Record<RosterField, number>> = {}
  row.eachCell({ includeEmpty: false }, (cell, column) => {
    const header = normalizedHeader(cellText(cell.value))
    for (const [field, aliases] of Object.entries(headerAliases) as [RosterField, readonly string[]][]) {
      if (columns[field] === undefined && aliases.some((alias) => normalizedHeader(alias) === header)) {
        columns[field] = column
      }
    }
  })
  return columns
}

function valueAt(row: Row, columns: Partial<Record<RosterField, number>>, field: RosterField): string {
  const column = columns[field]
  return column === undefined ? '' : cellText(row.getCell(column).value)
}

function parseRow(
  row: Row,
  rowNumber: number,
  columns: Partial<Record<RosterField, number>>,
): RosterPreviewRow {
  const studentNo = valueAt(row, columns, 'studentNo')
  const name = valueAt(row, columns, 'name')
  const rankText = valueAt(row, columns, 'rank')
  const rankNumber = rankText ? Number.parseInt(rankText, 10) : undefined
  const errors: string[] = []
  if (!studentNo) errors.push('缺少学号')
  if (!name) errors.push('缺少姓名')
  if (rankText && (!Number.isInteger(rankNumber) || (rankNumber ?? 0) <= 0)) errors.push('排名必须为正整数')

  const phone = valueAt(row, columns, 'phone')
  const address = valueAt(row, columns, 'address')
  return {
    rowNumber,
    status: errors.length > 0 ? 'invalid' : 'ready',
    errors,
    student: {
      studentNo,
      name,
      gender: parseGender(valueAt(row, columns, 'gender')),
      roles: splitValues(valueAt(row, columns, 'roles')),
      performanceLevel: parsePerformance(valueAt(row, columns, 'performanceLevel')),
      ...(rankNumber && rankNumber > 0 ? { rank: rankNumber } : {}),
      characterTags: splitValues(valueAt(row, columns, 'characterTags')),
      customTags: [],
      note: valueAt(row, columns, 'note'),
      contact: {
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
      },
      constraints: {
        frontPreference: 'none',
        avoidAdjacentStudentIds: [],
        preferredDeskMateStudentIds: [],
      },
      archived: false,
    },
  }
}

export async function previewRosterWorkbook(
  contents: ArrayBuffer,
  existingStudents: readonly StudentRecord[],
): Promise<RosterImportPreview> {
  const workbook = new Workbook()
  await workbook.xlsx.load(contents)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('工作簿不包含工作表')

  let headerRowNumber = 0
  let columns: Partial<Record<RosterField, number>> = {}
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 20); rowNumber += 1) {
    const candidate = getColumns(worksheet.getRow(rowNumber))
    if (candidate.studentNo !== undefined && candidate.name !== undefined) {
      headerRowNumber = rowNumber
      columns = candidate
      break
    }
  }
  if (!headerRowNumber) throw new Error('未找到包含“学号”和“姓名”的表头')

  const existingByStudentNo = new Map(
    existingStudents.map((student) => [canonicalStudentNo(student.studentNo), student]),
  )
  const seen = new Set<string>()
  const rows: RosterPreviewRow[] = []
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    if (!row.hasValues) continue
    const preview = parseRow(row, rowNumber, columns)
    if (preview.status === 'ready') {
      const studentNo = canonicalStudentNo(preview.student.studentNo)
      const existing = existingByStudentNo.get(studentNo)
      if (seen.has(studentNo)) {
        preview.status = 'duplicate-workbook'
        preview.errors.push('工作簿内学号重复')
      } else if (existing) {
        preview.status = 'duplicate-existing'
        preview.existingStudentId = existing.id
        preview.errors.push('学号已存在于班级')
      }
      seen.add(studentNo)
    }
    rows.push(preview)
  }

  const summary: Record<RosterRowStatus, number> = {
    ready: 0,
    invalid: 0,
    'duplicate-existing': 0,
    'duplicate-workbook': 0,
  }
  for (const row of rows) summary[row.status] += 1
  return { worksheetName: worksheet.name, headerRowNumber, columns, rows, summary }
}

function toStudentChanges(row: RosterPreviewRow): StudentRecordChanges {
  return { ...row.student }
}

export async function applyRosterImport(
  repository: Pick<ClassRepository, 'createStudent' | 'updateStudent'>,
  classId: string,
  preview: RosterImportPreview,
  duplicateStrategy: DuplicateStudentNoStrategy,
): Promise<RosterImportResult> {
  const conflicts = preview.rows.filter((row) => row.status !== 'ready')
  if (duplicateStrategy === 'reject' && conflicts.length > 0) {
    throw new Error(`名单包含 ${conflicts.length} 行错误或重复学号，请先修正`)
  }

  const result: RosterImportResult = { created: 0, updated: 0, skipped: 0 }
  for (const row of preview.rows) {
    if (row.status === 'ready') {
      await repository.createStudent({ classId, ...row.student })
      result.created += 1
    } else if (
      row.status === 'duplicate-existing' &&
      duplicateStrategy === 'update-existing' &&
      row.existingStudentId
    ) {
      await repository.updateStudent(row.existingStudentId, toStudentChanges(row))
      result.updated += 1
    } else {
      result.skipped += 1
    }
  }
  return result
}
