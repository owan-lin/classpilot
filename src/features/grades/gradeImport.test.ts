import { describe, expect, it } from 'vitest'
import { previewGradeCsv } from './gradeImport'
describe('grade CSV preview', () => { it('keeps error rows out of valid imports', () => { const preview = previewGradeCsv('学号,学科,考试,日期,得分,满分\n01,数学,月考,2026-01-10,88,100\n02,英语,月考,broken,101,100'); expect(preview.validCount).toBe(1); expect(preview.rows[1].errors).toContain('日期必须为 YYYY-MM-DD'); expect(preview.rows[1].grade).toBeUndefined() }) })
