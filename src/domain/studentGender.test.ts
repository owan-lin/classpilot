import { describe, expect, it } from 'vitest'
import { studentGenderAttributes, studentGenderLabel } from './studentGender'

describe('student gender presentation', () => {
  it.each([
    ['male', '男'],
    ['female', '女'],
    ['unspecified', '未填'],
  ] as const)('keeps %s mapped to %s', (gender, label) => {
    expect(studentGenderLabel(gender)).toBe(label)
    expect(studentGenderAttributes(gender)).toEqual({ 'data-gender': gender, 'data-gender-label': label })
  })
})
