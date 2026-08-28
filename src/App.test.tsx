import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { createTestRepository, disposeTestRepository, type TestRepositoryFixture } from '../tests/fixtures/repository'

const fixtures: TestRepositoryFixture[] = []
const setup = () => { const fixture = createTestRepository(); fixtures.push(fixture); return fixture }
afterEach(async () => { await Promise.all(fixtures.splice(0).map(disposeTestRepository)) })

describe('核心班级工作台', () => {
  it('显示新建班级空态', () => { render(<App repository={setup().repository} />); expect(screen.getByText('先创建一个班级')).toBeInTheDocument() })
  it('可以手动创建班级并进入核心功能', async () => { const user = userEvent.setup(); render(<App repository={setup().repository} />); await user.click(screen.getAllByRole('button', { name: '新建班级' })[0]); await user.type(screen.getByLabelText('班级名称'), '虚构班级'); await user.click(screen.getByRole('button', { name: '创建班级并开始' })); expect(await screen.findByRole('button', { name: '录入学生' })).toBeInTheDocument() })
  it('允许手动录入未填写学号的学生', async () => { const user = userEvent.setup(); const { repository } = setup(); const classroom = await repository.createClass({ name: '虚构班级', grade: '', academicYear: '' }); render(<App repository={repository} />); await user.click(await screen.findByRole('button', { name: '录入学生' })); await user.type(screen.getByLabelText('姓名'), '虚构学生'); await user.click(screen.getByRole('button', { name: '保存并继续' })); expect(await screen.findByText('虚构学生')).toBeInTheDocument(); expect(await repository.listStudents(classroom.id)).toHaveLength(1) })
  it('将无学生的待安排区说明为录入第一名学生', async () => { const { repository } = setup(); await repository.createClass({ name: '虚构班级', grade: '', academicYear: '' }); render(<App repository={repository} />); expect(await screen.findByText('还没有学生，先录入第一名学生。')).toBeInTheDocument() })
})
