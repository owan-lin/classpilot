import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createTestRepository, disposeTestRepository, newTestStudent, type TestRepositoryFixture } from '../tests/fixtures/repository'
import { createDefaultDraft } from './features/drafts/createDraft'

const fixtures: TestRepositoryFixture[] = []
const setup = () => { const fixture = createTestRepository(); fixtures.push(fixture); return fixture }
afterEach(async () => {
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 250))
  await Promise.all(fixtures.splice(0).map(disposeTestRepository))
})

describe('核心班级工作台', () => {
  it('录入响应晚于班级切换时，不会把旧班名单写进新班界面', async () => {
    const user = userEvent.setup()
    const { repository } = setup()
    const a = await repository.createClass({ name: 'A虚构班', grade: '', academicYear: '' })
    const b = await repository.createClass({ name: 'B虚构班', grade: '', academicYear: '' })
    await repository.createStudent({ ...newTestStudent(b.id), name: '乙班原有学生' })
    render(<App repository={repository} />)
    await user.click(await screen.findByRole('button', { name: '录入学生' }))
    await waitFor(async () => expect(await repository.getDraft(a.id)).toBeDefined())
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const original = repository.listStudents.bind(repository)
    const list = vi.spyOn(repository, 'listStudents').mockImplementation(async (id) => {
      if (id === a.id) await gate
      return original(id)
    })
    await user.type(screen.getByLabelText('姓名'), '甲班迟到响应')
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(list).toHaveBeenCalledWith(a.id))
    await user.click(screen.getByRole('button', { name: 'B虚构班' }))
    await waitFor(() => expect(screen.getByText('乙班原有学生')).toBeVisible())
    await act(async () => { release(); await gate })
    expect(screen.getByText('乙班原有学生')).toBeVisible()
    expect(screen.queryByText('甲班迟到响应')).not.toBeInTheDocument()
    expect(await original(a.id)).toHaveLength(1)
    expect(await original(b.id)).toHaveLength(1)
  })
  it('读取完成后显示新建班级空态', async () => { render(<App repository={setup().repository} />); expect(await screen.findByText('先创建一个班级')).toBeInTheDocument() })
  it('可以手动创建班级并进入核心功能', async () => { const user = userEvent.setup(); render(<App repository={setup().repository} />); await user.click(screen.getAllByRole('button', { name: '新建班级' })[0]); await user.type(screen.getByLabelText('班级名称'), '虚构班级'); await user.click(screen.getByRole('button', { name: '创建班级并开始' })); expect(await screen.findByRole('button', { name: '录入学生' })).toBeInTheDocument() })
  it('允许手动录入未填写学号的学生', async () => { const user = userEvent.setup(); const { repository } = setup(); const classroom = await repository.createClass({ name: '虚构班级', grade: '', academicYear: '' }); render(<App repository={repository} />); await user.click(await screen.findByRole('button', { name: '录入学生' })); await user.type(screen.getByLabelText('姓名'), '虚构学生'); await user.click(screen.getByRole('button', { name: '保存并继续' })); expect(await screen.findByText('虚构学生')).toBeInTheDocument(); expect(await repository.listStudents(classroom.id)).toHaveLength(1) })
  it('快速连续保存时保留两次录入且不覆盖后一次输入', async () => {
    const user = userEvent.setup()
    const { repository } = setup()
    const classroom = await repository.createClass({ name: '连续录入班', grade: '', academicYear: '' })
    const originalCreate = repository.createStudent.bind(repository)
    let releaseFirst!: () => void
    const firstRequest = new Promise<void>((resolve) => { releaseFirst = resolve })
    let calls = 0
    vi.spyOn(repository, 'createStudent').mockImplementation(async (input) => {
      calls += 1
      if (calls === 1) await firstRequest
      return originalCreate(input)
    })
    render(<App repository={repository} />)
    await user.click(await screen.findByRole('button', { name: '录入学生' }))
    await user.type(screen.getByLabelText('姓名'), '连续甲')
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    await user.clear(screen.getByLabelText('姓名'))
    await user.type(screen.getByLabelText('姓名'), '连续乙')
    // The second submit is ignored while the first write is in flight, but
    // the changed form must remain available for the next intentional submit.
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    releaseFirst()
    await waitFor(async () => expect(await repository.listStudents(classroom.id)).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(async () => expect(await repository.listStudents(classroom.id)).toHaveLength(2))
    expect(screen.getByText('连续甲')).toBeInTheDocument()
    expect(screen.getByText('连续乙')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
  it('切换班级后不会把旧班的编辑会话写入新班', async () => {
    const user = userEvent.setup()
    const { repository } = setup()
    const a = await repository.createClass({ name: 'A编辑隔离班', grade: '', academicYear: '' })
    const b = await repository.createClass({ name: 'B编辑隔离班', grade: '', academicYear: '' })
    const aStudent = await repository.createStudent({ ...newTestStudent(a.id), name: '甲班学生' })
    render(<App repository={repository} />)
    await user.click(await screen.findByRole('button', { name: '录入学生' }))
    await user.click(await screen.findByRole('button', { name: '编辑' }))
    await user.clear(screen.getByLabelText('姓名'))
    await user.type(screen.getByLabelText('姓名'), '不应写入乙班')
    await user.click(screen.getByRole('button', { name: 'B编辑隔离班' }))
    await user.clear(screen.getByLabelText('姓名'))
    await user.type(screen.getByLabelText('姓名'), '乙班新学生')
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(async () => expect(await repository.listStudents(b.id)).toHaveLength(1))
    expect((await repository.getStudent(aStudent.id))?.name).toBe('甲班学生')
    expect((await repository.listStudents(b.id))[0].name).toBe('乙班新学生')
  })
  it('修改 CSV 后必须重新预览，旧行不会被导入', async () => {
    const user = userEvent.setup()
    const { repository } = setup()
    const classroom = await repository.createClass({ name: 'CSV快照班', grade: '', academicYear: '' })
    await repository.createStudent({ ...newTestStudent(classroom.id), studentNo: 'CSV-01', name: 'CSV学生' })
    render(<App repository={repository} />)
    await user.click(await screen.findByRole('button', { name: '成绩' }))
    await user.click(screen.getByText('导入成绩'))
    const input = screen.getByLabelText('成绩 CSV')
    await user.type(input, '学号,学科,考试,日期,得分,满分\nCSV-01,数学,月考,2026-03-01,80,100')
    await user.click(screen.getByRole('button', { name: '预览' }))
    await user.clear(input)
    await user.type(input, '学号,学科,考试,日期,得分,满分\nCSV-01,数学,月考,2026-03-01,90,100')
    expect(screen.getByText('内容已修改，请重新预览')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认导入' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '预览' }))
    await user.click(screen.getByRole('button', { name: '确认导入' }))
    await waitFor(async () => expect(await repository.listGrades(classroom.id)).toHaveLength(1))
    expect((await repository.listGrades(classroom.id))[0].score).toBe(90)
  })
  it('将无学生的待安排区说明为空状态', async () => { const { repository } = setup(); await repository.createClass({ name: '虚构班级', grade: '', academicYear: '' }); render(<App repository={repository} />); expect(await screen.findByText('还没有学生。')).toBeInTheDocument() })
  it('删除已入座学生先清理草稿 assignments', async () => {
    const user = userEvent.setup()
    const { repository } = setup()
    const classroom = await repository.createClass({ name: '删除测试班', grade: '', academicYear: '' })
    const student = await repository.createStudent({ classId: classroom.id, studentNo: '01', name: '待删除', gender: 'unspecified', roles: [], performanceLevel: 'average', characterTags: [], customTags: [], note: '', contact: {}, constraints: { frontPreference: 'none', avoidAdjacentStudentIds: [], preferredDeskMateStudentIds: [] }, archived: false })
    const draft = createDefaultDraft(classroom.id)
    const seatId = draft.desks[0].seatIds[0]
    await repository.saveDraft({ ...draft, assignments: [{ seatId, studentId: student.id }] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App repository={repository} />)
    const occupied = await screen.findByRole('button', { name: /待删除.*点击查看档案/ })
    await user.click(occupied)
    await user.click(screen.getByRole('button', { name: '删除学生' }))
    await waitFor(async () => expect(await repository.listStudents(classroom.id)).toHaveLength(0))
    await waitFor(async () => expect((await repository.getDraft(classroom.id))?.assignments).toEqual([]))
    vi.restoreAllMocks()
  })
})
