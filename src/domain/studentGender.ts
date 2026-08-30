import type { Gender } from './types'

const genderLabels: Record<Gender, string> = {
  male: '男',
  female: '女',
  unspecified: '未填',
}

export function studentGenderLabel(gender: Gender): string {
  return genderLabels[gender]
}

/** Stable semantic attributes for every student surface (seat, pool, and profile). */
export function studentGenderAttributes(gender: Gender): { 'data-gender': Gender; 'data-gender-label': string } {
  return { 'data-gender': gender, 'data-gender-label': studentGenderLabel(gender) }
}
