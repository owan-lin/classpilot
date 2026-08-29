import type { DeskRecord, LayoutDraft } from './types'

export const classroomStage = {
  width: 1000,
  height: 650,
  grid: 25,
  minY: 75,
} as const

export const regularDeskSpec = { width: 190, height: 112, capacity: 2 as const } as const
export const specialDeskSpec = { width: 120, height: 82, capacity: 1 as const } as const

/** Validate that a regular desk grid remains usable on the fixed classroom canvas. */
export function isRegularGridUsable(rows: number, desksPerRow: number): boolean {
  if (!Number.isInteger(rows) || !Number.isInteger(desksPerRow) || rows < 1 || desksPerRow < 1) return false
  const lastX = 50 + (desksPerRow - 1) * (regularDeskSpec.width + 35) + regularDeskSpec.width
  const lastY = 125 + (rows - 1) * (regularDeskSpec.height + 38) + regularDeskSpec.height
  return lastX <= classroomStage.width && lastY <= classroomStage.height
}

export interface DeskPosition {
  x: number
  y: number
}

function normalize(value: number): number {
  return Number.isFinite(value) ? value : Number.NaN
}

export function deskOverlaps(
  first: DeskRecord,
  second: DeskRecord,
  firstPosition: DeskPosition = first,
  secondPosition: DeskPosition = second,
): boolean {
  return firstPosition.x < secondPosition.x + second.width
    && firstPosition.x + first.width > secondPosition.x
    && firstPosition.y < secondPosition.y + second.height
    && firstPosition.y + first.height > secondPosition.y
}

export function isDeskPositionValid(
  draft: Pick<LayoutDraft, 'desks'>,
  deskId: string,
  position: DeskPosition,
): boolean {
  const desk = draft.desks.find((item) => item.id === deskId)
  if (!desk) return false
  const x = normalize(position.x)
  const y = normalize(position.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (x < 0 || y < classroomStage.minY) return false
  if (x + desk.width > classroomStage.width || y + desk.height > classroomStage.height) return false
  return draft.desks.every((other) => other.id === deskId || !deskOverlaps(desk, other, { x, y }))
}

/** Free mode permits overlap and the podium area; a 32px grab strip must remain visible. */
export function isFreeDeskPositionVisible(desk: DeskRecord, position: DeskPosition): boolean {
  void desk
  const grab = 32
  return Number.isFinite(position.x) && Number.isFinite(position.y)
    && position.x + grab >= 0 && position.y + grab >= 0
    && position.x <= classroomStage.width - grab && position.y <= classroomStage.height - grab
}

export function constrainFreeDeskPosition(desk: DeskRecord, position: DeskPosition): DeskPosition {
  const grab = 32
  return { x: Math.min(classroomStage.width - grab, Math.max(grab - desk.width, position.x)), y: Math.min(classroomStage.height - grab, Math.max(grab - desk.height, position.y)) }
}

export function snapDeskPosition(position: DeskPosition): DeskPosition {
  return {
    x: Math.round(position.x / classroomStage.grid) * classroomStage.grid,
    y: Math.round(position.y / classroomStage.grid) * classroomStage.grid,
  }
}

export function alignedDeskPositions(desks: readonly DeskRecord[]): DeskPosition[] | undefined {
  const columns = 4
  const originX = 50
  const originY = 125
  const gapX = 35
  const gapY = 38
  const positions: DeskPosition[] = []

  const regular = desks.filter((desk) => desk.kind === 'regular')
  const special = desks.filter((desk) => desk.kind === 'special')
  for (const [index, desk] of regular.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = originX + column * (190 + gapX)
    const y = originY + row * (112 + gapY)
    positions.push({ x, y })
    if (x + desk.width > classroomStage.width || y + desk.height > classroomStage.height) return undefined
    for (let previous = 0; previous < index; previous += 1) {
      if (deskOverlaps(desk, regular[previous], { x, y }, positions[previous])) return undefined
    }
  }
  return [...positions, ...special.map((desk) => ({ x: desk.x, y: desk.y }))]
}

export function firstFreeDeskPosition(
  draft: Pick<LayoutDraft, 'desks'>,
  desk: DeskRecord,
): DeskPosition | undefined {
  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const position = snapDeskPosition({ x: 50 + column * 100, y: 100 + row * 75 })
      const candidateDraft = { desks: [...draft.desks, desk] }
      if (isDeskPositionValid(candidateDraft, desk.id, position)) return position
    }
  }
  return undefined
}

/** Rebuilds only regular desks. Special seats and their assignments survive unchanged. */
export function rebuildRegularLayout(
  draft: LayoutDraft,
  configuration: { rows: number; desksPerRow: number; capacity: 1 | 2 },
  identities: { deskId(): string; seatId(): string },
  timestamp: string,
): LayoutDraft {
  if (!isRegularGridUsable(configuration.rows, configuration.desksPerRow)) {
    throw new RangeError('普通座位数量超出画布可用范围')
  }
  const regular: DeskRecord[] = []
  for (let row = 0; row < configuration.rows; row += 1) for (let column = 0; column < configuration.desksPerRow; column += 1) regular.push({ id: identities.deskId(), classId: draft.classId, kind: 'regular', capacity: configuration.capacity, x: 50 + column * (regularDeskSpec.width + 35), y: 125 + row * (regularDeskSpec.height + 38), width: regularDeskSpec.width, height: regularDeskSpec.height, seatIds: Array.from({ length: configuration.capacity }, identities.seatId), createdAt: timestamp, updatedAt: timestamp })
  const special = draft.desks.filter((desk) => desk.kind === 'special').map((desk) => ({ ...desk, seatIds: [...desk.seatIds] }))
  const retainedSeats = new Set(special.flatMap((desk) => desk.seatIds))
  return { ...draft, desks: [...regular, ...special], assignments: draft.assignments.filter((assignment) => retainedSeats.has(assignment.seatId)) }
}
