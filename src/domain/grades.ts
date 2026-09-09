import type { GradeRecord, NewGradeRecord } from './types'

export interface GradeTrendPoint { examDate: string; subject: string; examName: string; percentage: number; score: number; fullScore: number }

export type GradeInput = Omit<NewGradeRecord, 'classId' | 'studentId'>

/** Validates the portable grade payload used by both CSV preview and persistence. */
export function validateGradeInput(input: GradeInput): GradeInput {
  const subject = input.subject.trim()
  if (!subject) throw new Error('学科不能为空')
  const examName = input.examName.trim()
  if (!examName) throw new Error('考试名称不能为空')
  if (!isIsoCalendarDate(input.examDate)) throw new Error('考试日期必须是 ISO 日期')
  if (!Number.isFinite(input.fullScore) || input.fullScore <= 0) throw new Error('满分必须大于 0')
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > input.fullScore) throw new Error('得分必须在 0 到满分之间')
  return { ...input, subject, examName, note: input.note?.trim() || undefined }
}

/** Rejects Date.parse rollover values such as 2026-02-29. */
export function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day)
}

/** Sorts a student's comparable score trend by ISO date; percentage is 0–100. */
export function gradeTrend(grades: readonly GradeRecord[]): GradeTrendPoint[] {
  return grades.map((grade) => ({ examDate: grade.examDate, subject: grade.subject, examName: grade.examName, percentage: grade.score / grade.fullScore * 100, score: grade.score, fullScore: grade.fullScore })).sort((a, b) => a.examDate.localeCompare(b.examDate) || a.subject.localeCompare(b.subject) || a.examName.localeCompare(b.examName))
}
