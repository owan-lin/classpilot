import { expect, test } from '@playwright/test'

type Page = import('@playwright/test').Page

async function createClass(page: Page, name: string) {
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await page.getByRole('textbox', { name: '班级名称' }).fill(name)
  await page.getByRole('button', { name: '创建班级并开始' }).click()
  await expect(page.getByTestId('classroom-canvas')).toBeVisible()
}

async function addStudent(page: Page, name: string, studentNo: string) {
  await page.getByRole('button', { name: '录入学生' }).click()
  await page.getByRole('textbox', { name: '姓名' }).fill(name)
  await page.locator('form.student-form').getByRole('textbox', { name: '学号', exact: true }).fill(studentNo)
  await page.getByRole('button', { name: '保存并继续' }).click()
}

function noHorizontalPageOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
}

test('canvas zoom is independent from the desktop shell and desks remain operable after zooming', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClass(page, '缩放独立班')
  await page.getByRole('button', { name: '编辑教室' }).click()

  const canvas = page.getByTestId('classroom-canvas')
  // Use the interactive rail controls: rail wrappers/bands may intentionally
  // be display-contents or aria-hidden and therefore have no own box.
  const classRail = page.getByRole('button', { name: '折叠班级轨道' })
  const toolRail = page.getByRole('button', { name: '折叠工具轨道' })
  const desk = canvas.getByRole('article').first()
  await expect(desk).toBeVisible()
  const [canvasBefore, classRailBefore, toolRailBefore, deskBefore] = await Promise.all([
    canvas.boundingBox(), classRail.boundingBox(), toolRail.boundingBox(), desk.boundingBox(),
  ])
  if (!canvasBefore || !classRailBefore || !toolRailBefore || !deskBefore) throw new Error('缩放前缺少工作台边界')

  const zoomIn = page.getByRole('button', { name: '放大画布' })
  const zoomOut = page.getByRole('button', { name: '缩小画布' })
  const resetZoom = page.getByRole('button', { name: '重置画布缩放' })
  await expect(zoomIn).toBeVisible()
  await expect(zoomOut).toBeVisible()
  await expect(resetZoom).toBeVisible()
  await zoomIn.click()

  const [canvasAfter, classRailAfter, toolRailAfter, deskAfter] = await Promise.all([
    canvas.boundingBox(), classRail.boundingBox(), toolRail.boundingBox(), desk.boundingBox(),
  ])
  if (!canvasAfter || !classRailAfter || !toolRailAfter || !deskAfter) throw new Error('缩放后缺少工作台边界')
  expect(Math.abs(canvasAfter.width - canvasBefore.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(canvasAfter.height - canvasBefore.height)).toBeLessThanOrEqual(2)
  expect(Math.abs(classRailAfter.width - classRailBefore.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(toolRailAfter.width - toolRailBefore.width)).toBeLessThanOrEqual(2)
  expect(deskAfter.width).toBeGreaterThan(deskBefore.width)
  await expect.poll(() => noHorizontalPageOverflow(page)).toBe(true)

  await page.getByRole('button', { name: '自由移动' }).click()
  const handle = desk.locator('header')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('缩放后的课桌拖动把手不可测量')
  const beforeStyle = await desk.getAttribute('style')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 32, handleBox.y + handleBox.height / 2 + 20, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => desk.getAttribute('style')).not.toBe(beforeStyle)
  await resetZoom.click()
})

test('a seated student can open the profile grade tab and save a grade in that dialog', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '档案成绩链路班')
  await addStudent(page, '入座学生', 'GRADE-01')
  await page.getByRole('button', { name: '排座 / 移位' }).click()
  await page.locator('.pool-student').filter({ hasText: '入座学生' }).click()
  await page.getByTestId('seat').filter({ hasText: '空位' }).first().click()
  const seated = page.getByTestId('seat').filter({ hasText: '入座学生' })
  await seated.click()
  const dialog = page.getByRole('dialog', { name: '入座学生' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: '成绩' }).click()
  const gradePanel = dialog.getByRole('tabpanel', { name: '入座学生 的成绩' })
  await expect(gradePanel).toContainText('暂无成绩记录')
  await gradePanel.getByRole('textbox', { name: '档案成绩学科' }).fill('数学')
  await gradePanel.getByRole('textbox', { name: '档案成绩考试' }).fill('单元测验')
  await gradePanel.getByLabel('档案成绩日期').fill('2026-09-02')
  await gradePanel.getByRole('spinbutton', { name: '档案成绩得分' }).fill('96')
  await gradePanel.getByRole('spinbutton', { name: '档案成绩满分' }).fill('100')
  await gradePanel.getByRole('button', { name: '保存成绩' }).click()
  await expect(page.getByRole('status')).toContainText('成绩已保存')
  await expect(gradePanel).toContainText('数学 · 单元测验 · 96/100')
})

test('rail states at desktop, tablet, and phone avoid mutual overlap and page overflow', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '跨宽度侧栏班')

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => noHorizontalPageOverflow(page)).toBe(true)
    const classToggle = page.locator('button.rail-toggle[aria-controls="class-rail"]')
    const toolToggle = page.locator('button.rail-toggle[aria-controls="tool-rail"]')
    if (viewport.width > 1024) {
      if (await classToggle.getAttribute('aria-expanded') === 'true') await classToggle.click()
      if (await toolToggle.getAttribute('aria-expanded') === 'true') await toolToggle.click()
      await expect.poll(() => noHorizontalPageOverflow(page)).toBe(true)
      continue
    }
    const canvasBefore = await page.getByTestId('classroom-canvas').boundingBox()
    if (!canvasBefore) throw new Error('抽屉展开前画布不可测量')
    await classToggle.click()
    await expect(page.getByTestId('class-panel')).toBeVisible()
    await expect(page.getByTestId('tool-panel')).toHaveAttribute('aria-hidden', 'true')
    await toolToggle.click()
    await expect(page.getByTestId('tool-panel')).toBeVisible()
    await expect(page.getByTestId('class-panel')).toHaveAttribute('aria-hidden', 'true')
    const canvasAfter = await page.getByTestId('classroom-canvas').boundingBox()
    if (!canvasAfter) throw new Error('抽屉展开后画布不可测量')
    expect(Math.abs(canvasAfter.width - canvasBefore.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(canvasAfter.height - canvasBefore.height)).toBeLessThanOrEqual(2)
    await expect.poll(() => noHorizontalPageOverflow(page)).toBe(true)
    await page.keyboard.press('Escape')
  }
})

test('new-class and grade actions preserve visible separation from adjacent controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: '新建班级' }).first().click()
  // The heading is visible but the dialog itself intentionally has no
  // accessible name yet, so scope through its stable semantic form class.
  const createDialog = page.locator('form.new-class[role="dialog"]')
  await expect(createDialog).toBeVisible()
  const createButton = createDialog.getByRole('button', { name: '创建班级并开始' })
  const createBox = await createButton.boundingBox()
  const plannedField = await createDialog.getByRole('spinbutton', { name: '计划人数' }).boundingBox()
  if (!createBox || !plannedField) throw new Error('新建班级弹窗控件不可测量')
  expect(createBox.y - (plannedField.y + plannedField.height)).toBeGreaterThanOrEqual(12)

  await page.getByRole('textbox', { name: '班级名称' }).fill('按钮留白班')
  await createButton.click()
  await addStudent(page, '留白学生', 'SPACE-01')
  await page.getByRole('button', { name: '排座 / 移位' }).click()
  await page.locator('.pool-student').filter({ hasText: '留白学生' }).click()
  await page.getByTestId('seat').filter({ hasText: '空位' }).first().click()
  await page.getByTestId('seat').filter({ hasText: '留白学生' }).click()
  const gradePanel = page.getByRole('tabpanel', { name: '留白学生 的成绩' })
  await page.getByRole('tab', { name: '成绩' }).click()
  const save = gradePanel.getByRole('button', { name: '保存成绩' })
  const fullScore = gradePanel.getByRole('spinbutton', { name: '档案成绩满分' })
  const [saveBox, fullScoreBox] = await Promise.all([save.boundingBox(), fullScore.boundingBox()])
  if (!saveBox || !fullScoreBox) throw new Error('成绩表单动作控件不可测量')
  expect(saveBox.y - (fullScoreBox.y + fullScoreBox.height)).toBeGreaterThanOrEqual(12)
})
