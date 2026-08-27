import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('ClassPilot shell', () => {
  it('renders the primary classroom surface', () => {
    render(<App />)
    expect(screen.getByText('ClassPilot')).toBeInTheDocument()
    expect(screen.getByLabelText(/未选择班级 座位表画布/)).toBeInTheDocument()
    expect(screen.getByText('先创建一个班级')).toBeInTheDocument()
  })

  it('switches between arrange and layout modes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '编辑教室' }))
    expect(screen.getByText('拖动桌子并添加特殊座位')).toBeInTheDocument()
  })

  it('updates the workspace and accessible canvas name when selecting a class', async () => {
    const user = userEvent.setup()
    render(<App />)
    const classList = within(screen.getByRole('navigation', { name: '班级列表' }))

    await user.click(classList.getByRole('button', { name: /初一（5）班/ }))

    expect(classList.getByRole('button', { name: /初一（5）班/ })).toHaveClass('active')
    expect(screen.getByLabelText('初一（5）班 座位表')).toBeInTheDocument()
  })

  it('exposes every empty seat with an accessible name', () => {
    render(<App />)
    expect(screen.getAllByRole('button', { name: '空座位' })).toHaveLength(6)
  })
})
