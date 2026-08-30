import { expect, test } from '@playwright/test'

const deploymentBase = process.env.CI ? '/classpilot' : ''
type Student = { name: string; studentNo: string }
type Page = import('@playwright/test').Page

async function createClass(page: Page, name: string) {
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await page.getByRole('textbox', { name: '班级名称' }).fill(name)
  await page.getByRole('button', { name: '创建班级并开始' }).click()
  await expect(page.getByRole('region', { name: `${name} 教室座位画布` })).toBeVisible()
}

async function createClassWithLayout(page: Page, name: string, rows: number, desksPerRow: number) {
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await page.getByRole('textbox', { name: '班级名称' }).fill(name)
  await page.getByRole('spinbutton', { name: '排数' }).fill(String(rows))
  await page.getByRole('spinbutton', { name: '每排桌数' }).fill(String(desksPerRow))
  await page.getByRole('button', { name: '创建班级并开始' }).click()
  await expect(page.getByRole('region', { name: `${name} 教室座位画布` })).toBeVisible()
}
async function openStudents(page: Page) {
  await page.getByRole('button', { name: '录入学生' }).click()
}

async function addStudent(page: Page, student: Student) {
  await page.getByRole('textbox', { name: '姓名' }).fill(student.name)
  await page.locator('form.student-form').getByRole('textbox', { name: '学号', exact: true }).fill(student.studentNo)
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`${student.name}.*${student.studentNo}`) })).toBeVisible()
}

async function openSeating(page: Page) {
  await page.getByRole('button', { name: '排座 / 移位' }).click()
  await expect(page.getByRole('complementary', { name: '待安排学生' })).toBeVisible()
}

function desk(page: Page, number: number) {
  return page.getByRole('article', { name: new RegExp(`第 ${number} 桌，`) })
}

function emptySeat(page: Page, deskNumber: number, seatNumber: number) {
  return desk(page, deskNumber).getByRole('button', { name: `第 ${deskNumber} 桌第 ${seatNumber} 座，空座位` })
}

function poolStudent(page: Page, name: string) {
  return page.locator('.pool-student').filter({ hasText: name })
}

test('空状态可以新建班级，并只暴露四个核心工作入口', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('先创建一个班级')).toBeVisible()
  await createClass(page, '核心空班')

  await expect(page.getByRole('button', { name: '排座 / 移位' })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑教室' })).toBeVisible()
  await expect(page.getByRole('button', { name: '录入学生' })).toBeVisible()
  await expect(page.getByText(/Excel|导入|历史|备份|导出|打印/)).toHaveCount(0)
})

test('publishes standalone PWA manifest metadata', async ({ request }) => {
  const response = await request.get(`${deploymentBase}/manifest.webmanifest`)
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
  const icon = await request.get(`${deploymentBase}/icons/192x192.png`)
  expect(icon.ok()).toBe(true)
})

test('不用 Excel 也能连续手动录入三名学生，并校验空名与重复学号', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '手动录入班')
  await openStudents(page)

  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByRole('alert')).toContainText('请输入学生姓名')

  await addStudent(page, { name: '虚构甲', studentNo: 'A-01' })
  await addStudent(page, { name: '虚构乙', studentNo: 'A-02' })
  await addStudent(page, { name: '虚构丙', studentNo: 'A-03' })
  await expect(page.getByRole('heading', { name: /学生档案 3/ })).toBeVisible()

  await page.getByRole('textbox', { name: '姓名' }).fill('重复号学生')
  await page.locator('form.student-form').getByRole('textbox', { name: '学号', exact: true }).fill('A-02')
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByRole('alert')).toContainText('已存在')
  await expect(page.getByRole('heading', { name: /学生档案 3/ })).toBeVisible()
})

test('支持点击排座、拖入空位、拖出空位、占座交换确认与取消', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '移位交互班')
  await openStudents(page)
  await addStudent(page, { name: '拖动甲', studentNo: 'D-01' })
  await addStudent(page, { name: '拖动乙', studentNo: 'D-02' })
  await addStudent(page, { name: '拖动丙', studentNo: 'D-03' })
  await openSeating(page)

  await poolStudent(page, '拖动甲').click()
  await emptySeat(page, 1, 1).click()
  await expect(desk(page, 1).getByRole('button', { name: /拖动甲.*D-01/ })).toBeVisible()

  await poolStudent(page, '拖动乙').dragTo(emptySeat(page, 1, 2))
  await expect(desk(page, 1).getByRole('button', { name: /拖动乙.*D-02/ })).toBeVisible()

  await desk(page, 1).getByRole('button', { name: /拖动乙.*D-02/ }).dragTo(emptySeat(page, 2, 1))
  await expect(desk(page, 2).getByRole('button', { name: /拖动乙.*D-02/ })).toBeVisible()

  const first = desk(page, 1).getByRole('button', { name: /拖动甲.*D-01/ })
  const second = desk(page, 2).getByRole('button', { name: /拖动乙.*D-02/ })
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    expect(dialog.message()).toContain('拖动甲')
    await dialog.dismiss()
  })
  await first.dragTo(second)
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    await dialog.accept()
  })
  await first.dragTo(second)
  await expect(desk(page, 1).getByRole('button', { name: /拖动乙.*D-02/ })).toBeVisible()
  await expect(desk(page, 2).getByRole('button', { name: /拖动甲.*D-01/ })).toBeVisible()
})

test('打开和关闭学生档案后仍保留排座上下文，Escape 可取消弹层', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '档案上下文班')
  await openStudents(page)
  await addStudent(page, { name: '档案甲', studentNo: 'P-01' })
  await openSeating(page)
  await poolStudent(page, '档案甲').click()
  await emptySeat(page, 1, 1).click()

  await desk(page, 1).getByRole('button', { name: /档案甲.*P-01/ }).click()
  await expect(page.getByRole('dialog', { name: '档案甲' })).toBeVisible()
  await page.getByRole('button', { name: '关闭学生档案' }).click()
  await expect(page.getByRole('dialog', { name: '档案甲' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '排座 / 移位' })).toHaveAttribute('aria-pressed', 'true')

  await desk(page, 1).getByRole('button', { name: /档案甲.*P-01/ }).click()
  await expect(page.getByRole('dialog', { name: '档案甲' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '档案甲' })).toHaveCount(0)
})

test('教室编辑器支持普通/特殊座位增删、对齐与自由移动并持久化坐标', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '画布编辑班')
  await page.getByRole('button', { name: '编辑教室' }).click()
  const canvas = page.getByRole('region', { name: '画布编辑班 教室座位画布' })
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('button', { name: '对齐模式' })).toHaveAttribute('aria-pressed', 'true')

  const initialCount = await canvas.getByRole('article').count()
  await page.getByRole('button', { name: '+ 普通座位' }).click()
  await page.getByRole('button', { name: '+ 特殊座位' }).click()
  await expect(canvas.getByRole('article')).toHaveCount(initialCount + 2)

  const addedRegular = page.getByRole('article', { name: `第 ${initialCount + 1} 桌，2 个座位` })
  const addedSpecial = page.getByRole('article', { name: '特殊座，1 个座位' })
  page.once('dialog', (dialog) => dialog.accept())
  await addedRegular.getByRole('button', { name: `删除课桌 ${initialCount + 1}` }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await addedSpecial.getByRole('button', { name: '删除特殊座' }).click()
  await expect(canvas.getByRole('article')).toHaveCount(initialCount)

  await page.getByRole('button', { name: '重排对齐' }).click()
  await expect(page.getByRole('status')).toContainText('按网格对齐')
  await page.getByRole('button', { name: '自由移动' }).click()
  const firstDesk = desk(page, 1)
  const before = await firstDesk.getAttribute('style')
  const box = await firstDesk.locator('header').boundingBox()
  const secondBox = await desk(page, 2).boundingBox()
  expect(box).not.toBeNull()
  expect(secondBox).not.toBeNull()
  if (!box || !secondBox) throw new Error('课桌没有可拖动的边界框')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(secondBox.x + 10, secondBox.y + 10, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => firstDesk.getAttribute('style')).not.toBe(before)
  const moved = await firstDesk.getAttribute('style')
  await page.waitForTimeout(300)
  await page.reload()
  await expect(page.getByRole('region', { name: '画布编辑班 教室座位画布' })).toBeVisible()
  await page.getByRole('button', { name: '编辑教室' }).click()
  const withoutActiveLayer = (style: string | null) => style?.replace(/z-index: \d+;/, '')
  await expect.poll(() => desk(page, 1).getAttribute('style').then(withoutActiveLayer)).toBe(withoutActiveLayer(moved))
})

test('自由编辑使用真实 pointer 流程，可重叠/进讲台，Escape 与 pointercancel 回滚', async ({ page }) => {
  await page.goto('/')
  await createClass(page, 'Pointer 验收班')
  await page.getByRole('button', { name: '编辑教室' }).click()
  await page.getByRole('button', { name: '自由移动' }).click()

  const canvas = page.getByRole('region', { name: 'Pointer 验收班 教室座位画布' })
  const first = desk(page, 1)
  const second = desk(page, 2)
  const firstHeader = first.locator('header')
  const secondBox = await second.boundingBox()
  const firstBox = await firstHeader.boundingBox()
  expect(secondBox).not.toBeNull()
  expect(firstBox).not.toBeNull()
  if (!secondBox || !firstBox) throw new Error('课桌缺少可操作边界框')

  const before = await first.getAttribute('style')
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(secondBox.x + 10, secondBox.y + 10, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => first.getAttribute('style')).not.toBe(before)

  const movedBox = await first.boundingBox()
  expect(movedBox).not.toBeNull()
  if (!movedBox) throw new Error('课桌移动后缺少边界框')
  expect(movedBox.x).toBeLessThan(secondBox.x + secondBox.width)
  expect(movedBox.x + movedBox.width).toBeGreaterThan(secondBox.x)
  await expect(canvas.locator('[data-testid="podium"]')).toBeVisible({ timeout: 2_000 })
})

test('自由模式的已有重叠布局仍可移动，且可进入讲台区域', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '重叠后移动班')
  await page.getByRole('button', { name: '编辑教室' }).click()
  await page.getByRole('button', { name: '自由移动' }).click()

  const canvas = page.getByRole('region', { name: '重叠后移动班 教室座位画布' })
  const first = desk(page, 1)
  const second = desk(page, 2)
  const firstHeader = first.locator('header')
  const secondHeader = second.locator('header')
  const firstBox = await firstHeader.boundingBox()
  const secondBox = await second.boundingBox()
  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  if (!firstBox || !secondBox) throw new Error('课桌缺少可操作边界框')

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 12 })
  await page.mouse.up()

  const overlapBox = await first.boundingBox()
  expect(overlapBox).not.toBeNull()
  if (!overlapBox) throw new Error('重叠后的课桌缺少边界框')
  expect(overlapBox.x).toBeLessThan(secondBox.x + secondBox.width)
  expect(overlapBox.x + overlapBox.width).toBeGreaterThan(secondBox.x)

  const beforeSecondMove = await second.getAttribute('style')
  const canvasBox = await canvas.boundingBox()
  const secondHeaderBox = await secondHeader.boundingBox()
  expect(canvasBox).not.toBeNull()
  expect(secondHeaderBox).not.toBeNull()
  if (!canvasBox || !secondHeaderBox) throw new Error('讲台区域或课桌缺少边界框')

  await page.mouse.move(secondHeaderBox.x + secondHeaderBox.width / 2, secondHeaderBox.y + secondHeaderBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + 56, { steps: 12 })
  await page.mouse.up()

  await expect.poll(() => second.getAttribute('style')).not.toBe(beforeSecondMove)
  const movedIntoPodium = await second.boundingBox()
  expect(movedIntoPodium).not.toBeNull()
  if (!movedIntoPodium) throw new Error('移动到讲台区域后的课桌缺少边界框')
  expect(movedIntoPodium.x).toBeLessThan(canvasBox.x + canvasBox.width / 2 + 16)
  expect(movedIntoPodium.x + movedIntoPodium.width).toBeGreaterThan(canvasBox.x + canvasBox.width / 2 - 16)
  expect(movedIntoPodium.y).toBeLessThan(canvasBox.y + 150)
  await expect(page.getByRole('status')).toContainText('课桌位置已更新并自动保存')
})

test('自由编辑的 Escape/pointercancel 回滚，删除按钮不启动拖动', async ({ page }) => {
  await page.goto('/')
  await createClass(page, 'Pointer 回滚班')
  await page.getByRole('button', { name: '编辑教室' }).click()
  await page.getByRole('button', { name: '自由移动' }).click()
  const first = desk(page, 1)
  const firstHeader = first.locator('header')
  const rollbackBefore = await first.getAttribute('style')
  expect(rollbackBefore).not.toBeNull()
  if (!rollbackBefore) throw new Error('课桌缺少初始布局样式')
  const rollbackBox = await firstHeader.boundingBox()
  expect(rollbackBox).not.toBeNull()
  if (!rollbackBox) throw new Error('课桌回滚前缺少边界框')
  await page.mouse.move(rollbackBox.x + rollbackBox.width / 2, rollbackBox.y + rollbackBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rollbackBox.x + 80, rollbackBox.y + 50, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  const rollbackAfter = await first.getAttribute('style')
  expect(rollbackAfter?.replace(/z-index: \d+;/, '')).toBe(rollbackBefore.replace(/z-index: \d+;/, ''))
  expect(rollbackAfter).toContain('z-index: 4;')

  const cancelBefore = await first.getAttribute('style')
  expect(cancelBefore).not.toBeNull()
  if (!cancelBefore) throw new Error('课桌缺少取消前布局样式')
  await firstHeader.dispatchEvent('pointerdown', { pointerId: 7, clientX: rollbackBox.x + 10, clientY: rollbackBox.y + 10, buttons: 1 })
  await firstHeader.dispatchEvent('pointermove', { pointerId: 7, clientX: rollbackBox.x + 100, clientY: rollbackBox.y + 60, buttons: 1 })
  await firstHeader.dispatchEvent('pointercancel', { pointerId: 7, clientX: rollbackBox.x + 100, clientY: rollbackBox.y + 60, buttons: 0 })
  await expect(first).toHaveAttribute('style', cancelBefore)

  const deleteButton = first.getByRole('button', { name: /删除课桌/ })
  await deleteButton.dispatchEvent('pointerdown', { pointerId: 8, clientX: 0, clientY: 0, buttons: 1 })
  await expect(first).toHaveAttribute('style', cancelBefore)
})

test('删除占座课桌无需确认，学生回到待安排区且资料不丢失', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '删除课桌班')
  await openStudents(page)
  await addStudent(page, { name: '保留甲', studentNo: 'K-01' })
  await openSeating(page)
  await poolStudent(page, '保留甲').click()
  await emptySeat(page, 1, 1).click()
  await page.getByRole('button', { name: '编辑教室' }).click()

  let confirmationTriggered = false
  page.on('dialog', async (dialog) => {
    confirmationTriggered = true
    await dialog.dismiss()
  })
  await desk(page, 1).getByRole('button', { name: '删除课桌 1' }).click()
  expect(confirmationTriggered).toBe(false)
  await expect(page.getByRole('status')).toContainText('回到待安排区')
  await openSeating(page)
  await expect(poolStudent(page, '保留甲')).toContainText('K-01')
})

test('动态座位画布允许 6×4 与 8×5 的有效班级参数', async ({ page }) => {
  await page.goto('/')
  await createClassWithLayout(page, '六乘四班', 6, 4)
  await expect(page.getByRole('region', { name: '六乘四班 教室座位画布' }).getByRole('article')).toHaveCount(24)

  await createClassWithLayout(page, '八乘五班', 8, 5)
  await expect(page.getByRole('region', { name: '八乘五班 教室座位画布' }).getByRole('article')).toHaveCount(40)
})

test('拖动中的课桌位于其余课桌之上，并按实际 canvas 坐标提交移动', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClassWithLayout(page, '层级拖动班', 6, 4)
  await page.getByRole('button', { name: '编辑教室' }).click()
  await page.getByRole('button', { name: '自由移动' }).click()

  const canvas = page.getByRole('region', { name: '层级拖动班 教室座位画布' })
  const movingDesk = desk(page, 1)
  const otherDesk = desk(page, 2)
  const canvasBox = await canvas.boundingBox()
  const headerBox = await movingDesk.locator('header').boundingBox()
  expect(canvasBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  if (!canvasBox || !headerBox) throw new Error('画布或课桌拖动把手不可用')
  const before = await movingDesk.getAttribute('style')

  await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.62, { steps: 8 })
  const movingZIndex = await movingDesk.evaluate((element) => Number(getComputedStyle(element).zIndex))
  const otherZIndex = await otherDesk.evaluate((element) => Number(getComputedStyle(element).zIndex))
  expect(movingZIndex).toBeGreaterThan(otherZIndex)
  await page.mouse.up()
  await expect.poll(() => movingDesk.getAttribute('style')).not.toBe(before)
})

test('学生和成绩操作区可仅用键盘抵达，桌面视口中的提交按钮稳定可见', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClass(page, '键盘表单班')
  await openStudents(page)

  const name = page.getByRole('textbox', { name: '姓名' })
  await name.focus()
  await page.keyboard.type('键盘学生')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.type('KB-01')
  await page.keyboard.press('Tab')
  await page.keyboard.type('键盘备注')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '保存并继续' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /键盘学生.*KB-01/ })).toBeVisible()

  await page.getByRole('button', { name: '成绩' }).click()
  const gradeForm = page.locator('form.student-form')
  const studentSelect = gradeForm.getByRole('combobox', { name: '成绩学生' })
  await studentSelect.focus()
  await page.keyboard.press('ArrowDown')
  await expect(studentSelect).not.toHaveValue('')
  await page.keyboard.press('Tab')
  await expect(gradeForm.getByRole('textbox', { name: '学科' })).toBeFocused()

  for (const button of await gradeForm.getByRole('button').all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    if (!box) throw new Error('成绩操作按钮没有可见布局')
    expect(box.y + box.height).toBeLessThanOrEqual(900)
    expect(box.x + box.width).toBeLessThanOrEqual(1440)
  }
})

test.describe('响应式核心工作台', () => {
  for (const width of [375, 768, 1024, 1440]) {
    test(`${width}px 没有页面级横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await createClass(page, `响应式${width}`)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }
})
