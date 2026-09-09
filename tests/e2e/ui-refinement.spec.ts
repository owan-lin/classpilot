import { expect, test } from '@playwright/test'

test('classroom prioritizes names and reveals tools only when needed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await page.getByRole('textbox', { name: '班级名称' }).fill('简洁界面虚构班')
  await page.getByRole('button', { name: '创建班级并开始' }).click()
  const desk = page.getByTestId('classroom-canvas').getByRole('article').first()
  await expect(desk).toBeVisible()
  await expect(desk.locator('header')).toBeHidden()
  expect(await desk.textContent()).not.toMatch(/第\s*\d+\s*桌|课桌\s*\d+/)
  await expect(page.getByTestId('podium')).toHaveText('讲台')
  await page.getByRole('button', { name: '编辑教室' }).click()
  await expect(page.getByRole('heading', { name: '编辑教室', exact: true })).toHaveCount(1)
  await expect(desk.locator('header')).toBeVisible()
  expect(await desk.locator('header').textContent()).not.toMatch(/课桌\s*\d+/)

  await page.getByRole('button', { name: '折叠工具轨道' }).click()
  await expect(page.getByRole('button', { name: '录入学生' })).toBeVisible()
  await page.getByRole('button', { name: '录入学生' }).click()
  await expect(page.getByTestId('tool-panel')).toBeVisible()
  await expect(page.getByRole('heading', { name: '录入学生', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: '成绩', exact: true }).click()
  await expect(page.getByLabel('成绩 CSV')).toBeHidden()
  await page.locator('summary').filter({ hasText: '导入成绩' }).click()
  await expect(page.getByLabel('成绩 CSV')).toBeVisible()
  await page.getByRole('button', { name: '录入学生' }).click()
  for (const [name, gender] of [['示例小林', 'male'], ['示例小夏', 'female']]) {
    await page.getByRole('textbox', { name: '姓名' }).fill(name)
    await page.getByRole('combobox', { name: '性别' }).selectOption(gender)
    await page.getByRole('button', { name: '保存并继续' }).click()
    await expect(page.locator('.roster').getByText(name, { exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: '排座 / 移位' }).click()
  for (const name of ['示例小林', '示例小夏']) {
    await page.locator('.pool-student').filter({ hasText: name }).click()
    await page.getByTestId('seat').filter({ hasText: '空位' }).first().click()
  }
  await page.screenshot({ path: 'output/playwright/classroom-refined.png' })
})

test('a single-seat desk uses its full surface instead of retaining an empty second column', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await page.getByRole('textbox', { name: '班级名称' }).fill('单人桌虚构班')
  await page.getByRole('combobox', { name: '每桌容量' }).selectOption('1')
  await page.getByRole('button', { name: '创建班级并开始' }).click()
  const desk = page.getByTestId('classroom-canvas').getByRole('article').first()
  await expect(desk.getByTestId('seat')).toHaveCount(1)
  const [deskBox, seatBox] = await Promise.all([desk.boundingBox(), desk.getByTestId('seat').boundingBox()])
  expect(deskBox).not.toBeNull()
  expect(seatBox!.width).toBeGreaterThan(deskBox!.width * 0.85)
})
