import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  GripVertical,
  LayoutGrid,
  Move,
  Plus,
  SearchX,
  UserRound,
  X,
} from 'lucide-react'
import type { StudentRecord } from '../domain/types'

const genderMeta = {
  male: { short: '男', label: '男生' },
  female: { short: '女', label: '女生' },
  unspecified: { short: '未', label: '未填写性别' },
} as const

const performanceMeta = {
  excellent: '表现优秀',
  good: '表现良好',
  average: '表现稳定',
  needs_support: '需要关注',
} as const

const frontPreferenceMeta = {
  none: '无前排要求',
  preferred: '建议安排前排',
  required: '需要安排前排',
} as const

type StudentAction = (student: StudentRecord) => void

export function ModeSwitch({ mode, onChange }: { mode: 'arrange' | 'layout'; onChange: (mode: 'arrange' | 'layout') => void }) {
  return (
    <div className="mode-switch" role="group" aria-label="编辑模式">
      <button type="button" aria-pressed={mode === 'arrange'} className={mode === 'arrange' ? 'is-selected' : ''} onClick={() => onChange('arrange')}>
        <UserRound size={15} aria-hidden="true" />安排学生
      </button>
      <button type="button" aria-pressed={mode === 'layout'} className={mode === 'layout' ? 'is-selected' : ''} onClick={() => onChange('layout')}>
        <LayoutGrid size={15} aria-hidden="true" />编辑教室
      </button>
    </div>
  )
}

export function WarningNotice({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <section className="warning-notice" aria-labelledby="constraint-warning-title">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong id="constraint-warning-title">{count} 项座位条件待确认</strong>
        <span>启用前建议检查前排需求；系统不会自动替老师做决定。</span>
      </div>
      <button type="button" onClick={onOpen}>查看条件 <ArrowRight size={14} aria-hidden="true" /></button>
    </section>
  )
}

export function StudentSeat({ student, onActivate }: { student?: StudentRecord; onActivate: (student?: StudentRecord) => void }) {
  if (!student) {
    return (
      <button type="button" className="student-seat is-empty" aria-label="空座位，可安排学生" onClick={() => onActivate()}>
        <Plus size={16} aria-hidden="true" /><span>空座</span>
      </button>
    )
  }

  const gender = genderMeta[student.gender]
  const detail = student.roles[0] ?? student.characterTags[0] ?? performanceMeta[student.performanceLevel]

  return (
    <button type="button" className={`student-seat tone-${student.gender}`} aria-label={`打开学生档案：${student.name}，${student.studentNo}号，${gender.label}`} onClick={() => onActivate(student)}>
      <span className="student-seat__number">{student.studentNo}</span>
      <strong>{student.name}</strong>
      <span className="student-seat__detail">{detail}</span>
      <span className="student-seat__gender" aria-hidden="true">{gender.short}</span>
    </button>
  )
}

export function ClassroomDesk({ label, seatIds, students, capacity = 2, editing = false, onSeatActivate, className = '' }: {
  label: string
  seatIds: string[]
  students: Array<StudentRecord | undefined>
  capacity?: 1 | 2
  editing?: boolean
  onSeatActivate: (seatId: string, student?: StudentRecord) => void
  className?: string
}) {
  return (
    <section className={`classroom-desk capacity-${capacity} ${editing ? 'is-editing' : ''} ${className}`} aria-label={`${label}，${capacity === 1 ? '单人桌' : '双人桌'}`}>
      <span className="classroom-desk__label">{label}</span>
      {editing && <Move className="classroom-desk__move" size={15} aria-label="可移动桌子" />}
      <div className="classroom-desk__surface">
        {Array.from({ length: capacity }, (_, index) => <StudentSeat key={seatIds[index] ?? `${label}-${index}`} student={students[index]} onActivate={(student) => onSeatActivate(seatIds[index], student)} />)}
      </div>
    </section>
  )
}

export function StudentListCard({ student, selected = false, onSelect }: { student: StudentRecord; selected?: boolean; onSelect: StudentAction }) {
  const gender = genderMeta[student.gender]
  return (
    <button type="button" aria-pressed={selected} className={`student-list-card tone-${student.gender} ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(student)} aria-label={`选择待安排学生：${student.name}，${student.studentNo}号，${gender.label}`}>
      <GripVertical className="student-list-card__grip" size={15} aria-hidden="true" />
      <span className="student-avatar" aria-hidden="true">{student.name.slice(-1)}</span>
      <span className="student-list-card__copy"><strong>{student.name}</strong><small>{student.studentNo} 号 · {gender.label}</small></span>
      <ArrowRight size={15} aria-hidden="true" />
    </button>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <section className="empty-state" aria-live="polite">
      <span className="empty-state__icon"><SearchX size={21} aria-hidden="true" /></span>
      <strong>{title}</strong><p>{description}</p>{action}
    </section>
  )
}

export function ProfileDrawer({ student, onClose }: { student: StudentRecord; onClose: () => void }) {
  const gender = genderMeta[student.gender]
  const frontPreference = frontPreferenceMeta[student.constraints.frontPreference]
  const isFrontPriority = student.constraints.frontPreference !== 'none'

  return (
    <aside className="profile-drawer" role="dialog" aria-modal="false" aria-labelledby="profile-title">
      <header className="profile-drawer__header">
        <div><span>学生档案</span><strong id="profile-title">{student.name}</strong></div>
        <button type="button" className="icon-button" aria-label="关闭学生档案" onClick={onClose} autoFocus><X size={19} aria-hidden="true" /></button>
      </header>

      <div className={`profile-identity tone-${student.gender}`}>
        <span className="profile-avatar" aria-hidden="true">{student.name.slice(-1)}</span>
        <div><strong>{student.name}</strong><span>{student.studentNo} 号 · {gender.label}</span></div>
        <span className="profile-status">在读</span>
      </div>

      {isFrontPriority && (
        <div className="drawer-warning" role="note">
          <AlertTriangle size={17} aria-hidden="true" /><div><strong>座位提醒</strong><span>{frontPreference}</span></div>
        </div>
      )}

      <section className="drawer-section" aria-labelledby="teaching-profile-title">
        <div className="drawer-section__title"><BookOpen size={16} aria-hidden="true" /><strong id="teaching-profile-title">教学信息</strong></div>
        <dl className="profile-grid">
          <div><dt>课堂表现</dt><dd>{performanceMeta[student.performanceLevel]}</dd></div>
          <div><dt>前排需求</dt><dd>{frontPreference}</dd></div>
          <div><dt>班级职务</dt><dd>{student.roles[0] ?? '暂无'}</dd></div>
          <div><dt>性格标签</dt><dd>{student.characterTags[0] ?? '暂无'}</dd></div>
        </dl>
      </section>

      <section className="drawer-section" aria-labelledby="notes-title">
        <div className="drawer-section__title"><strong id="notes-title">课堂备注</strong></div>
        <p className="profile-note">{student.note || '暂无课堂备注。可在完整档案中补充教学相关信息。'}</p>
      </section>

      <footer className="profile-drawer__footer">
        <button type="button" className="button-secondary" onClick={onClose}>完成</button>
        <button type="button" className="button-primary">打开完整档案</button>
      </footer>
    </aside>
  )
}
