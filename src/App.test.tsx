import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import {
  createTestRepository,
  disposeTestRepository,
  newTestStudent,
  type TestRepositoryFixture,
} from '../tests/fixtures/repository'

const repositories: TestRepositoryFixture[] = []

function createRepositoryFixture() {
  const fixture = createTestRepository()
  repositories.push(fixture)
  return fixture
}

afterEach(async () => {
  await Promise.all(repositories.splice(0).map(disposeTestRepository))
})

describe('ClassPilot shell', () => {
  it('renders the empty local classroom state', () => {
    render(<App repository={createRepositoryFixture().repository} />)
    expect(screen.getByText('ClassPilot')).toBeInTheDocument()
    expect(screen.getByLabelText(/未选择班级 座位表画布/)).toBeInTheDocument()
    expect(screen.getByText('先创建一个班级')).toBeInTheDocument()
  })

  it('switches between arrange and layout modes', async () => {
    const user = userEvent.setup()
    render(<App repository={createRepositoryFixture().repository} />)
    await user.click(screen.getByRole('button', { name: '编辑教室' }))
    expect(screen.getByText('拖动桌子并添加特殊座位')).toBeInTheDocument()
  })

  it('creates an empty class and initializes its local seating draft', async () => {
    const user = userEvent.setup()
    render(<App repository={createRepositoryFixture().repository} />)

    await user.click(screen.getAllByRole('button', { name: '新建班级' })[0])
    await user.type(screen.getByRole('textbox', { name: '班级名称' }), '虚构空班')
    await user.click(screen.getByRole('button', { name: /^创建班级$/ }))

    expect(await screen.findByLabelText('虚构空班 座位表')).toBeInTheDocument()
    expect(screen.getByText('尚未导入学生')).toBeInTheDocument()
  })

  it('keeps unassigned students visible when the default six seats are insufficient', async () => {
    const user = userEvent.setup()
    const { repository } = createRepositoryFixture()
    const classroom = await repository.createClass({ name: '座位不足班', grade: '', academicYear: '' })
    await Promise.all(Array.from({ length: 7 }, (_, index) =>
      repository.createStudent(newTestStudent(classroom.id, String(index + 1))),
    ))
    render(<App repository={repository} />)

    const student = await screen.findByRole('button', { name: /选择待安排学生：虚构学生 1/ })
    await user.click(student)
    await user.click(screen.getAllByRole('button', { name: '空座位，可安排学生' })[0])

    expect(await screen.findByRole('button', { name: /打开学生档案：虚构学生 1/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /选择待安排学生：/ })).toHaveLength(6)
  })
})
