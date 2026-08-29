import type { GradeRecord } from './types'

export interface GradeTrendPoint { examDate: string; subject: string; examName: string; percentage: number; score: number; fullScore: number }

/** Sorts a student's comparable score trend by ISO date; percentage is 0–100. */
export function gradeTrend(grades: readonly GradeRecord[]): GradeTrendPoint[] {
  return grades.map((grade) => ({ examDate: grade.examDate, subject: grade.subject, examName: grade.examName, percentage: grade.score / grade.fullScore * 100, score: grade.score, fullScore: grade.fullScore })).sort((a, b) => a.examDate.localeCompare(b.examDate) || a.subject.localeCompare(b.subject) || a.examName.localeCompare(b.examName))
}
