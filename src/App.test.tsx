import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ClassRecord, ClassRepository, LayoutDraft } from './domain/types'
import App from './App'

const timestamp = '2026-08-01T12:00:00.000Z'
const classes: ClassRecord[] = [
  { id: 'class-1', name: '初二（3）班', grade: '八年级', academicYear: '2026–2027', archived: false, createdAt: timestamp, updatedAt: timestamp },
  { id: 'class-2', name: '初一（5）班', grade: '七年级', academicYear: '2026–2027', archived: false, createdAt: timestamp, updatedAt: timestamp },
]

function mockRepository(overrides: Partial<ClassRepository> = {}): ClassRepository {
  return {
    listClasses: vi.fn().mockResolvedValue([]),
    getClass: vi.fn().mockResolvedValue(undefined),
    createClass: vi.fn(), updateClass: vi.fn(), deleteClass: vi.fn(),
    listStudents: vi.fn().mockResolvedValue([]),
    getStudent: vi.fn().mockResolvedValue(undefined),
    createStudent: vi.fn(), updateStudent: vi.fn(), deleteStudent: vi.fn(),
    getDraft: vi.fn().mockResolvedValue(undefined),
    saveDraft: vi.fn().mockResolvedValue(undefined), deleteDraft: vi.fn(),
    listSnapshots: vi.fn().mockResolvedValue([]),
    publishSnapshot: vi.fn(), restoreSnapshot: vi.fn(),
    exportBackup: vi.fn(), restoreBackup: vi.fn(),
    ...overrides,
  } as ClassRepository
}

function emptyDraft(classId: string): LayoutDraft {
  const desks = Array.from({ length: 3 }, (_, deskIndex) => ({
    id: `desk-${deskIndex}`,
    classId,
    kind: 'regular' as const,
    capacity: 2 as const,
    x: deskIndex * 200,
    y: 150,
    width: 190,
    height: 112,
    seatIds: [`seat-${deskIndex}-1`, `seat-${deskIndex}-2`],
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  return { id: 'draft-1', classId, podium: { x: 355, y: 22, width: 185, height: 58 }, desks, assignments: [], createdAt: timestamp, updatedAt: timestamp }
}

describe('ClassPilot shell', () => {
  it('renders the empty classroom onboarding surface', async () => {
    render(<App repository={mockRepository()} />)
    expect(screen.getByText('ClassPilot')).toBeInTheDocument()
    expect(screen.getByLabelText(/未选择班级 座位表画布/)).toBeInTheDocument()
    expect(await screen.findByText('先创建一个班级')).toBeInTheDocument()
  })

  it('switches between arrange and layout modes', async () => {
    const user = userEvent.setup()
    render(<App repository={mockRepository()} />)
    await user.click(screen.getByRole('button', { name: '编辑教室' }))
    expect(screen.getByText('拖动桌子并添加特殊座位')).toBeInTheDocument()
  })

  it('updates the workspace and accessible canvas name when selecting a class', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ listClasses: vi.fn().mockResolvedValue(classes) })
    render(<App repository={repository} />)
    const classList = within(screen.getByRole('navigation', { name: '班级列表' }))

    await user.click(await classList.findByRole('button', { name: /初一（5）班/ }))

    expect(classList.getByRole('button', { name: /初一（5）班/ })).toHaveClass('is-active')
    expect(await screen.findByLabelText('初一（5）班 座位表')).toBeInTheDocument()
  })

  it('exposes every empty seat with a descriptive accessible name', async () => {
    const repository = mockRepository({
      listClasses: vi.fn().mockResolvedValue([classes[0]]),
      getDraft: vi.fn().mockResolvedValue(emptyDraft(classes[0].id)),
    })
    render(<App repository={repository} />)
    expect(await screen.findAllByRole('button', { name: '空座位，可安排学生' })).toHaveLength(6)
  })
})
