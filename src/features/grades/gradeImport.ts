import type { GradeImportPreview, GradeImportRow } from '../../domain/types'
import { validateGradeInput } from '../../domain/grades'

const aliases: Record<string, string[]> = {
  studentNo: ['学号', 'studentno', 'student number'], studentName: ['姓名', 'name'], subject: ['学科', 'subject'], examName: ['考试', '考试名称', 'exam', 'exam name'], examDate: ['日期', '考试日期', 'date', 'exam date'], score: ['得分', 'score'], fullScore: ['满分', 'full score'], note: ['备注', 'note'],
}
const normalized = (value: string) => value.trim().toLocaleLowerCase('zh-CN')

/** RFC4180-style enough for teacher exports: commas and quoted commas are preserved. */
export function parseCsv(text: string): string[][] {
  const result: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) { const char = text[index]; const next = text[index + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1 } else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) result.push(row); row = []; cell = '' } else cell += char
  }
  row.push(cell); if (row.some((value) => value.trim())) result.push(row); return result
}

export function previewGradeCsv(text: string, mapping: Record<string, string> = {}): GradeImportPreview {
  const matrix = parseCsv(text); if (!matrix.length) return { rows: [], validCount: 0, errorCount: 1 }
  const headers = matrix[0].map((cell) => cell.trim())
  const column = (key: string) => mapping[key] ?? headers.find((header) => aliases[key]?.includes(normalized(header)))
  const value = (cells: string[], key: string) => { const header = column(key); const index = header ? headers.indexOf(header) : -1; return index < 0 ? '' : (cells[index] ?? '').trim() }
  const rows: GradeImportRow[] = matrix.slice(1).map((cells, index) => {
    const studentNo = value(cells, 'studentNo'), studentName = value(cells, 'studentName'), subject = value(cells, 'subject'), examName = value(cells, 'examName'), examDate = value(cells, 'examDate'), scoreText = value(cells, 'score'), fullScoreText = value(cells, 'fullScore'), score = Number(scoreText), fullScore = Number(fullScoreText), errors: string[] = []
    if (!studentNo && !studentName) errors.push('缺少学号或姓名')
    if (!studentNo) errors.push('当前版本导入需要学号匹配学生')
    try {
      // Explicit blank checks avoid Number('') becoming a valid zero score.
      if (!scoreText) throw new Error('得分不能为空')
      if (!fullScoreText) throw new Error('满分不能为空')
      validateGradeInput({ subject, examName, examDate, score, fullScore, ...(value(cells, 'note') ? { note: value(cells, 'note') } : {}) })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '成绩数据无效')
    }
    return { rowNumber: index + 2, raw: Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ''])), studentNo, studentName, ...(errors.length ? {} : { grade: { subject, examName, examDate, score, fullScore, ...(value(cells, 'note') ? { note: value(cells, 'note') } : {}) } }), errors }
  })
  return { rows, validCount: rows.filter((row) => !row.errors.length).length, errorCount: rows.filter((row) => row.errors.length).length }
}
