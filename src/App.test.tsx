import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('ClassPilot shell', () => {
  it('renders the primary classroom surface', () => {
    render(<App />)
    expect(screen.getByText('ClassPilot')).toBeInTheDocument()
    expect(screen.getByLabelText('未选择班级 座位表')).toBeInTheDocument()
    expect(screen.getByText('讲 台')).toBeInTheDocument()
  })

  it('switches between arrange and layout modes', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '编辑教室' }))
    expect(screen.getByText('拖动桌子并添加特殊座位')).toBeInTheDocument()
  })
})
