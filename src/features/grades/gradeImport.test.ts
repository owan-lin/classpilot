import { describe, expect, it } from 'vitest'
import { previewGradeCsv } from './gradeImport'
describe('grade CSV preview', () => {
  it('keeps error rows out of valid imports', () => { const preview = previewGradeCsv('学号,学科,考试,日期,得分,满分\n01,数学,月考,2026-01-10,88,100\n02,英语,月考,broken,101,100'); expect(preview.validCount).toBe(1); expect(preview.rows[1].errors).toContain('考试日期必须是 ISO 日期'); expect(preview.rows[1].grade).toBeUndefined() })
  it('uses the same strict grade validation as persistence', () => {
    const preview = previewGradeCsv('学号,学科,考试,日期,得分,满分\n01,数学,月考,2026-02-29,80,100\n02,英语,月考,2026-02-28,,100')
    expect(preview.validCount).toBe(0)
    expect(preview.rows[0].errors).toContain('考试日期必须是 ISO 日期')
    expect(preview.rows[1].errors).toContain('得分不能为空')
  })
})
