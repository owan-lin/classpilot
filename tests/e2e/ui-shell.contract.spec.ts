import { expect, test } from '@playwright/test'

type Page = import('@playwright/test').Page
type Gender = 'male' | 'female' | 'unspecified'

const rail = (page: Page, side: 'class' | 'tool') => page.getByTestId(`${side}-rail`)
const railBand = (page: Page, side: 'class' | 'tool') => page.getByTestId(`${side}-rail-band`)
const canvas = (page: Page) => page.getByTestId('classroom-canvas')
const toolPanel = (page: Page) => page.getByTestId('tool-panel')

type Box = NonNullable<Awaited<ReturnType<Page['locator']>['boundingBox']>>

function expectCloseTo(actual: number, expected: number, tolerance = 2) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

function expectSameBox(actual: Box, expected: Box, tolerance = 2) {
  expectCloseTo(actual.x, expected.x, tolerance)
  expectCloseTo(actual.y, expected.y, tolerance)
  expectCloseTo(actual.width, expected.width, tolerance)
  expectCloseTo(actual.height, expected.height, tolerance)
}

async function expectDeepBlue(locator: ReturnType<Page['getByTestId']>) {
  const color = await locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  const channels = color.match(/\d+/g)?.map(Number)
  expect(channels, `深蓝轨道应使用不透明颜色，收到 ${color}`).toHaveLength(3)
  if (!channels) throw new Error('无法解析轨道背景色')
  const [red, green, blue] = channels
  expect(red).toBeLessThanOrEqual(35)
  expect(green).toBeGreaterThanOrEqual(45)
  expect(green).toBeLessThanOrEqual(95)
  expect(blue).toBeGreaterThanOrEqual(70)
}

async function createClass(page: Page, name: string) {
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await page.getByRole('textbox', { name: '班级名称' }).fill(name)
  await page.getByRole('button', { name: '创建班级并开始' }).click()
  await expect(canvas(page)).toBeVisible()
}

async function addStudent(page: Page, student: { name: string; studentNo: string; gender: Gender }) {
  await page.getByRole('button', { name: '录入学生' }).click()
  const form = page.locator('form.student-form')
  await form.getByRole('textbox', { name: '姓名' }).fill(student.name)
  await form.getByRole('combobox', { name: '性别' }).selectOption(student.gender)
  await form.getByRole('textbox', { name: '学号', exact: true }).fill(student.studentNo)
  await form.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByRole('button', { name: new RegExp(student.name) })).toBeVisible()
}

function genderedStudent(page: Page, gender: Gender, name: string) {
  return page.locator(`[data-gender="${gender}"]`).filter({ hasText: name })
}

async function expectGenderSemantics(page: Page, gender: Gender, name: string, label: RegExp) {
  const student = genderedStudent(page, gender, name)
  await expect(student).toBeVisible()
  await expect(student).toContainText(label)
}

test('E2E boot does not reload while opening the new-class form', async ({ page }) => {
  let applicationNavigations = 0
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && frame.url().includes('127.0.0.1:4173')) applicationNavigations += 1
  })

  await page.goto('/')
  await page.getByRole('button', { name: '新建班级' }).first().click()
  await expect(page.getByRole('textbox', { name: '班级名称' })).toBeVisible()
  await page.waitForTimeout(750)
  await expect(page.getByRole('textbox', { name: '班级名称' })).toBeVisible()
  expect(applicationNavigations).toBe(1)
})

test('gender is semantic and readable in pool, seat, selected state, and profile', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '性别语义班')
  await addStudent(page, { name: '虚构男生', studentNo: 'G-01', gender: 'male' })
  await addStudent(page, { name: '虚构女生', studentNo: 'G-02', gender: 'female' })
  await addStudent(page, { name: '虚构未填', studentNo: 'G-03', gender: 'unspecified' })

  await page.getByRole('button', { name: '排座 / 移位' }).click()
  await expectGenderSemantics(page, 'male', '虚构男生', /男/)
  await expectGenderSemantics(page, 'female', '虚构女生', /女/)
  await expectGenderSemantics(page, 'unspecified', '虚构未填', /未填/)

  const selected = genderedStudent(page, 'male', '虚构男生')
  await selected.click()
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await expect(selected).toHaveAttribute('data-gender', 'male')
  await page.getByTestId('seat').filter({ hasText: '空位' }).first().click()

  const seated = page.getByTestId('seat').filter({ hasText: '虚构男生' })
  await expect(seated).toHaveAttribute('data-gender', 'male')
  await expect(seated).toContainText(/男/)
  await seated.click()
  const profile = page.getByRole('dialog', { name: '虚构男生' })
  await expect(profile.getByTestId('gender-status')).toHaveAttribute('data-gender', 'male')
  await expect(profile.getByTestId('gender-status')).toContainText(/男/)
})

test('1440×900 concept layout keeps rails, panels, canvas, podium, and desks in their intended zones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClass(page, '概念图工作台班')
  const seatedStudent = { name: '完整姓名学生甲', studentNo: 'VIS-01', gender: 'female' as const }
  await addStudent(page, seatedStudent)
  await page.getByRole('button', { name: '排座 / 移位' }).click()
  await genderedStudent(page, seatedStudent.gender, seatedStudent.name).click()
  await page.getByTestId('seat').filter({ hasText: '空位' }).first().click()
  const occupiedSeat = page.getByTestId('seat').filter({ hasText: seatedStudent.name })
  await expect(occupiedSeat).toBeVisible()
  await expect(occupiedSeat).toContainText(seatedStudent.name)
  await expect(occupiedSeat).toContainText(/女/)
  await expect(occupiedSeat).toHaveAttribute('data-gender', seatedStudent.gender)
  const emptySeat = canvas(page).getByTestId('seat').filter({ hasText: '空位' }).first()
  await expect(emptySeat).toBeVisible()
  const occupiedSeatBox = await occupiedSeat.boundingBox()
  const emptySeatBox = await emptySeat.boundingBox()
  if (!occupiedSeatBox || !emptySeatBox) throw new Error('概念图缺少可测量的已占座或空位')
  expectCloseTo(occupiedSeatBox.height, emptySeatBox.height)
  expect(occupiedSeatBox.height).toBeGreaterThanOrEqual(70)
  expect(occupiedSeatBox.height).toBeLessThanOrEqual(85)
  expect(emptySeatBox.height).toBeGreaterThanOrEqual(70)
  expect(emptySeatBox.height).toBeLessThanOrEqual(85)

  const workbench = page.getByTestId('classroom-workbench')
  await expect(workbench).toBeVisible()
  const initialCanvas = await canvas(page).boundingBox()
  const classRail = await rail(page, 'class').boundingBox()
  const toolRail = await rail(page, 'tool').boundingBox()
  const classRailBand = railBand(page, 'class')
  const toolRailBand = railBand(page, 'tool')
  const classRailBandBox = await classRailBand.boundingBox()
  const toolRailBandBox = await toolRailBand.boundingBox()
  const classPanel = await page.getByTestId('class-panel').boundingBox()
  const initialToolPanel = await toolPanel(page).boundingBox()
  const classToggle = await page.getByRole('button', { name: '折叠班级轨道' }).boundingBox()
  const toolToggle = await page.getByRole('button', { name: '折叠工具轨道' }).boundingBox()
  const podium = await page.getByTestId('podium').boundingBox()
  const firstDesk = await canvas(page).getByRole('article').first().boundingBox()
  if (!initialCanvas || !classRail || !toolRail || !classRailBandBox || !toolRailBandBox || !classPanel || !initialToolPanel || !classToggle || !toolToggle || !podium || !firstDesk)
    throw new Error('概念图工作台缺少可测量的必要区域')

  // These are deliberately ranges, not screenshot pixels: the approved concept
  // calls for a 106px left rail, ~201px class panel, ≥850px teaching canvas,
  // ~204px tool panel, and 72px right rail at this viewport.
  expectCloseTo(classToggle.x, 0)
  expect(classToggle.width).toBeGreaterThanOrEqual(90)
  expect(classToggle.width).toBeLessThanOrEqual(120)
  expectCloseTo(classPanel.x, classToggle.width)
  expect(classPanel.width).toBeGreaterThanOrEqual(180)
  expect(classPanel.width).toBeLessThanOrEqual(225)
  expectCloseTo(initialCanvas.x, classPanel.x + classPanel.width)
  expect(initialCanvas.width).toBeGreaterThanOrEqual(850)
  expect(initialCanvas.width / 1440).toBeLessThan(0.66)
  expectCloseTo(initialToolPanel.x, initialCanvas.x + initialCanvas.width)
  expect(initialToolPanel.width).toBeGreaterThanOrEqual(180)
  expect(initialToolPanel.width).toBeLessThanOrEqual(240)
  expectCloseTo(toolToggle.x + toolToggle.width, 1440)
  expect(toolToggle.width).toBeGreaterThanOrEqual(60)
  expect(toolToggle.width).toBeLessThanOrEqual(90)
  expectCloseTo(initialCanvas.y, 0)
  expectCloseTo(initialCanvas.height, 900)
  expectCloseTo(classPanel.y, initialCanvas.y)
  expectCloseTo(initialToolPanel.y, initialCanvas.y)
  expectCloseTo(classRail.height, initialCanvas.height)
  expectCloseTo(toolRail.height, initialCanvas.height)
  expectCloseTo(classRailBandBox.x, 0)
  expectCloseTo(classRailBandBox.y, 0)
  expectCloseTo(classRailBandBox.height, 900)
  expect(classRailBandBox.width).toBeGreaterThanOrEqual(90)
  expect(classRailBandBox.width).toBeLessThanOrEqual(120)
  expectCloseTo(toolRailBandBox.x + toolRailBandBox.width, 1440)
  expectCloseTo(toolRailBandBox.y, 0)
  expectCloseTo(toolRailBandBox.height, 900)
  expect(toolRailBandBox.width).toBeGreaterThanOrEqual(60)
  expect(toolRailBandBox.width).toBeLessThanOrEqual(90)
  await expectDeepBlue(classRailBand)
  await expectDeepBlue(toolRailBand)

  // The podium stays centered in the teaching area and is visibly smaller than a
  // row of desks; desks retain a card-like teaching-table scale below it.
  expectCloseTo(podium.x + podium.width / 2, initialCanvas.x + initialCanvas.width / 2, 3)
  expect(podium.width / initialCanvas.width).toBeGreaterThan(0.18)
  expect(podium.width / initialCanvas.width).toBeLessThan(0.36)
  expect(podium.height).toBeGreaterThanOrEqual(48)
  expect(podium.height).toBeLessThanOrEqual(100)
  expect(firstDesk.width).toBeGreaterThanOrEqual(145)
  expect(firstDesk.width).toBeLessThanOrEqual(205)
  expect(firstDesk.height).toBeGreaterThanOrEqual(80)
  expect(firstDesk.height).toBeLessThanOrEqual(125)
  expect(firstDesk.y).toBeGreaterThan(podium.y + podium.height)
  await expect(canvas(page).getByTestId('seat').first()).toBeVisible()
  const firstSeat = await canvas(page).getByTestId('seat').first().boundingBox()
  if (!firstSeat) throw new Error('概念图课桌缺少可测量座位')
  expect(firstSeat.width).toBeGreaterThanOrEqual(60)
  expect(firstSeat.width).toBeLessThanOrEqual(95)
  expect(firstSeat.height).toBeGreaterThanOrEqual(48)
  expect(firstSeat.height).toBeLessThanOrEqual(85)
  await expect(canvas(page).getByRole('article').first()).toHaveCSS('transform', 'none')

  const toolNavigation = page.getByRole('navigation', { name: '班级工具' })
  for (const tool of ['排座 / 移位', '编辑教室', '录入学生', '成绩']) {
    const control = toolNavigation.getByRole('button', { name: tool })
    await expect(control).toBeVisible()
    await expect(control).toContainText(tool)
    await expect(control.locator('svg')).toHaveCount(1)
    const controlBox = await control.boundingBox()
    if (!controlBox) throw new Error(`右侧工具 ${tool} 不可测量`)
    expect(controlBox.x).toBeGreaterThanOrEqual(toolRailBandBox.x - 1)
    expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(toolRailBandBox.x + toolRailBandBox.width + 1)
    expect(controlBox.y).toBeGreaterThanOrEqual(toolRailBandBox.y - 1)
    expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(toolRailBandBox.y + toolRailBandBox.height + 1)
    await expect.poll(() => control.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const topmost = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return topmost === element || element.contains(topmost)
    })).toBe(true)
  }

  for (const tool of ['排座 / 移位', '编辑教室', '录入学生', '成绩']) {
    await page.getByRole('button', { name: tool }).click()
    const currentCanvas = await canvas(page).boundingBox()
    const currentPanel = await toolPanel(page).boundingBox()
    if (!currentCanvas || !currentPanel) throw new Error('切换工具后工作台区域丢失')
    expectSameBox(currentCanvas, initialCanvas)
    expectSameBox(currentPanel, initialToolPanel)
  }
})

test('desktop rails collapse independently and return space to the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClass(page, '折叠班')
  const before = await canvas(page).boundingBox()
  expect(before).not.toBeNull()
  if (!before) throw new Error('画布不可测量')

  const classToggle = page.getByRole('button', { name: '折叠班级轨道' })
  await expect(classToggle).toHaveAttribute('aria-controls', 'class-rail')
  await classToggle.click()
  await expect(classToggle).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await canvas(page).boundingBox())?.width).toBeGreaterThan(before.width)

  const toolToggle = page.getByRole('button', { name: '折叠工具轨道' })
  await expect(toolToggle).toHaveAttribute('aria-controls', 'tool-rail')
  await toolToggle.click()
  await expect(toolToggle).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await canvas(page).boundingBox())?.width).toBeGreaterThan(before.width)
})

test('wide desktop workbench never page-scrolls and keeps the student tool panel usable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClass(page, '宽屏契约班')

  const toolNavigation = page.getByRole('navigation', { name: '班级工具' })
  for (const width of [1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(toolNavigation).toBeVisible()
    const navigationBox = await toolNavigation.boundingBox()
    if (!navigationBox) throw new Error(`宽度 ${width}px 时工具轨道不可测量`)
    expect(navigationBox.x).toBeGreaterThanOrEqual(0)
    expect(navigationBox.x + navigationBox.width).toBeLessThanOrEqual(width)
  }

  const regularDesk = canvas(page).getByRole('article').first()
  const regularDeskBox = await regularDesk.boundingBox()
  if (!regularDeskBox) throw new Error('宽屏教室缺少普通双人桌')
  expect(regularDeskBox.width / regularDeskBox.height).toBeGreaterThanOrEqual(1.5)
  const deskSeats = regularDesk.getByTestId('seat')
  await expect(deskSeats).toHaveCount(2)
  const [leftSeat, rightSeat] = await Promise.all([deskSeats.nth(0).boundingBox(), deskSeats.nth(1).boundingBox()])
  if (!leftSeat || !rightSeat) throw new Error('普通双人桌缺少可测量座位')
  expect(leftSeat.x).toBeLessThan(rightSeat.x)
  expectCloseTo(leftSeat.y, rightSeat.y, 3)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: '录入学生' }).click()
  const panel = toolPanel(page)
  const studentForm = panel.locator('form.student-form')
  await expect(studentForm).toBeVisible()
  await expect.poll(() => panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect.poll(() => studentForm.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  const fields = studentForm.locator('input, select')
  expect(await fields.count()).toBeGreaterThan(0)
  for (let index = 0; index < await fields.count(); index += 1) {
    const fieldBox = await fields.nth(index).boundingBox()
    if (!fieldBox) throw new Error(`录入学生字段 ${index + 1} 不可测量`)
    expect(fieldBox.height).toBeGreaterThanOrEqual(36)
    expect(fieldBox.height).toBeLessThanOrEqual(52)
  }
})

test('375×812 uses bounded overlay drawers and never overflows the page horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/')
  await createClass(page, '响应式班级')

  for (const viewport of [{ width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  await page.getByRole('button', { name: '打开班级轨道' }).click()
  const classDrawer = rail(page, 'class')
  await expect(classDrawer).toHaveAttribute('data-overlay', 'true')
  await expect(page.getByTestId('drawer-backdrop')).toBeVisible()
  const classPanel = page.getByTestId('class-panel')
  await expect.poll(async () => {
    const x = (await classPanel.boundingBox())?.x
    return x !== undefined && Math.abs(x) <= 2
  }).toBe(true)
  const classPanelBox = await classPanel.boundingBox()
  expect(classPanelBox).not.toBeNull()
  if (!classPanelBox) throw new Error('班级抽屉不可测量')
  expectCloseTo(classPanelBox.x, 0)
  expect(classPanelBox.width).toBeLessThanOrEqual(375)
  expectCloseTo(classPanelBox.height, 812)
  const close = classDrawer.getByRole('button', { name: '关闭班级轨道' })
  await close.focus()
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '打开班级轨道' })).toBeFocused()
  await expect(page.getByTestId('class-panel')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByTestId('drawer-backdrop')).toBeHidden()

  await page.getByRole('button', { name: '打开工具轨道' }).click()
  const toolDrawer = rail(page, 'tool')
  await expect(toolDrawer).toHaveAttribute('data-overlay', 'true')
  await expect(page.getByTestId('drawer-backdrop')).toBeVisible()
  await expect.poll(async () => {
    const box = await toolPanel(page).boundingBox()
    return Boolean(box && Math.abs(375 - (box.x + box.width)) <= 2)
  }).toBe(true)
  const toolPanelBox = await toolPanel(page).boundingBox()
  expect(toolPanelBox).not.toBeNull()
  if (!toolPanelBox) throw new Error('工具抽屉不可测量')
  expectCloseTo(toolPanelBox.x + toolPanelBox.width, 375)
  expect(toolPanelBox.width).toBeLessThanOrEqual(375)
  expectCloseTo(toolPanelBox.height, 812)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('drawer-backdrop')).toBeHidden()
  await expect(page.getByRole('navigation', { name: '班级工具' })).toBeHidden()
})

test('seat, delete, and realign remain operational through the tool rail', async ({ page }) => {
  await page.goto('/')
  await createClass(page, '核心功能壳层班')
  await addStudent(page, { name: '功能学生', studentNo: 'S-01', gender: 'unspecified' })
  await page.getByRole('button', { name: '排座 / 移位' }).click()
  await genderedStudent(page, 'unspecified', '功能学生').click()
  await page.getByTestId('seat').filter({ hasText: '空位' }).first().click()
  await expect(page.getByTestId('seat').filter({ hasText: '功能学生' })).toBeVisible()

  await page.getByRole('button', { name: '编辑教室' }).click()
  const desksBefore = await canvas(page).getByRole('article').count()
  await page.getByRole('button', { name: '+ 普通座位' }).click()
  await expect(canvas(page).getByRole('article')).toHaveCount(desksBefore + 1)
  await page.getByRole('button', { name: '重排对齐' }).click()
  await expect(page.getByRole('status')).toContainText(/对齐/)
  await page.getByRole('button', { name: `删除课桌 ${desksBefore + 1}` }).click()
  await expect(canvas(page).getByRole('article')).toHaveCount(desksBefore)
})
