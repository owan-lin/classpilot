import { expect, test } from '@playwright/test'

async function createClass(page: import('@playwright/test').Page, name: string) {
  await page.locator('.new-class').click()
  await page.getByRole('textbox', { name: '班级名称' }).fill(name)
  await page.getByRole('button', { name: '创建班级', exact: true }).click()
  await expect(page.getByRole('region', { name: `${name} 座位表` })).toBeVisible()
}

test('creates an empty local class and initializes its seating workspace', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('ClassPilot')).toBeVisible()
  await expect(page.getByText('先创建一个班级')).toBeVisible()
  await createClass(page, '虚构空班')
  await expect(page.getByText('尚未导入学生')).toBeVisible()
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
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: 'icons/192x192.png', sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ src: 'icons/512x512.png', sizes: '512x512', purpose: 'maskable' }),
  ]))
  const icon = await request.get('/icons/192x192.png')
  expect(icon.ok()).toBe(true)
})

test('reloads a locally created class from the cached app while offline', async ({ context, page }) => {
  await page.goto('/')
  await createClass(page, '离线虚构班')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('ClassPilot')).toBeVisible()
    await expect(page.getByRole('region', { name: '离线虚构班 座位表' })).toBeVisible()
    await expect(page.getByText('尚未导入学生')).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('restores a published history snapshot into a new draft', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '历史虚构班')
  await page.getByRole('button', { name: '启用此座位表' }).click()
  await page.getByRole('button', { name: /历史版本 1/ }).click()
  await expect(page.getByRole('dialog', { name: '座位历史版本' })).toBeVisible()
  await page.getByRole('button', { name: '恢复为草稿' }).click()
  await expect(page.getByText('历史版本已恢复为新的座位草稿，原历史记录保持不变')).toBeVisible()
})

