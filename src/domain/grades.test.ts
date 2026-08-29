import { describe, expect, it } from 'vitest'
import { gradeTrend } from './grades'
import type { GradeRecord } from './types'
const record = (examDate: string, score: number, fullScore: number): GradeRecord => ({ id: examDate, classId: 'c', studentId: 's', subject: '数学', examName: examDate, examDate, score, fullScore, createdAt: '', updatedAt: '' })
describe('gradeTrend', () => { it('sorts ISO dates and normalizes different full scores', () => expect(gradeTrend([record('2026-02-01', 45, 50), record('2026-01-01', 80, 100)])).toEqual([expect.objectContaining({ percentage: 80, examDate: '2026-01-01' }), expect.objectContaining({ percentage: 90, examDate: '2026-02-01' })])) })
