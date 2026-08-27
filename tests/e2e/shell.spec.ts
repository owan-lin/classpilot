import { expect, test } from '@playwright/test'

test('shows the ClassPilot seating workspace', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('ClassPilot')).toBeVisible()
  await expect(page.getByText('讲 台')).toBeVisible()
  await expect(page.getByRole('button', { name: '启用此座位表' })).toBeVisible()
})

test('publishes standalone PWA manifest metadata', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)

  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: 'ClassPilot 班级座位助手',
    short_name: 'ClassPilot',
    display: 'standalone',
    lang: 'zh-CN',
  })
})

test('reloads the cached application shell while offline', async ({ context, page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ClassPilot')).toBeVisible()
    await expect(page.getByRole('button', { name: '启用此座位表' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test.fixme('rejects a duplicate student number in the roster workflow', async () => {})
test.fixme('explains a seat shortage without losing students', async () => {})
test.fixme('supports an empty class from creation through seating', async () => {})
test.fixme('restores history into a new draft while preserving the snapshot', async () => {})
test.fixme('exports in one target and restores the same backup in the other', async () => {})
test.fixme('declares suitable manifest icons before claiming PWA installability', async () => {})
