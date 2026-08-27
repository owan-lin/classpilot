import { expect, test } from '@playwright/test'

test('shows the ClassPilot seating workspace', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('ClassPilot')).toBeVisible()
  await expect(page.getByText('讲 台')).toBeVisible()
  await expect(page.getByRole('button', { name: '启用此座位表' })).toBeVisible()
})
