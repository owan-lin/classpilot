import { expect, test } from '@playwright/test'

type Page = import('@playwright/test').Page
type Gender = 'male' | 'female' | 'unspecified'

const rail = (page: Page, side: 'class' | 'tool') => page.getByTestId(`${side}-rail`)
const canvas = (page: Page) => page.getByTestId('classroom-canvas')
const toolPanel = (page: Page) => page.getByTestId('tool-panel')

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

test('desktop keeps one aligned classroom workbench while tool contents change in one slot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await createClass(page, '工作台班')

  const workbench = page.getByTestId('classroom-workbench')
  await expect(workbench).toBeVisible()
  const initialCanvas = await canvas(page).boundingBox()
  const classRail = await rail(page, 'class').boundingBox()
  const initialToolPanel = await toolPanel(page).boundingBox()
  expect(initialCanvas).not.toBeNull()
  expect(classRail).not.toBeNull()
  expect(initialToolPanel).not.toBeNull()
  if (!initialCanvas || !classRail || !initialToolPanel) throw new Error('工作台缺少可测量的三栏区域')
  expect(initialCanvas.width).toBeGreaterThan(classRail.width)
  expect(initialCanvas.width).toBeGreaterThan(initialToolPanel.width)
  expect(Math.abs(initialCanvas.y - classRail.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(initialCanvas.y - initialToolPanel.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(initialCanvas.y + initialCanvas.height - classRail.y - classRail.height)).toBeLessThanOrEqual(2)

  for (const tool of ['排座 / 移位', '编辑教室', '录入学生', '成绩']) {
    await page.getByRole('button', { name: tool }).click()
    const currentCanvas = await canvas(page).boundingBox()
    const currentPanel = await toolPanel(page).boundingBox()
    expect(currentCanvas).not.toBeNull()
    expect(currentPanel).not.toBeNull()
    if (!currentCanvas || !currentPanel) throw new Error('切换工具后工作台区域丢失')
    expect(currentCanvas).toEqual(initialCanvas)
    expect(currentPanel.x).toBe(initialToolPanel.x)
    expect(currentPanel.width).toBe(initialToolPanel.width)
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

test('responsive rails are overlay drawers with usable focus and no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/')
  await createClass(page, '响应式班级')

  for (const viewport of [{ width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  await page.getByRole('button', { name: '打开班级轨道' }).click()
  const drawer = rail(page, 'class')
  await expect(drawer).toHaveAttribute('data-overlay', 'true')
  const close = drawer.getByRole('button', { name: '关闭班级轨道' })
  await close.focus()
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '打开班级轨道' })).toBeFocused()
  await expect(page.getByTestId('class-panel')).toHaveAttribute('aria-hidden', 'true')
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
