import type { DeskRecord, LayoutDraft } from './types'

export const classroomStage = {
  width: 1000,
  height: 650,
  grid: 25,
  minY: 75,
} as const

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

  for (const [index, desk] of desks.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = originX + column * (190 + gapX)
    const y = originY + row * (112 + gapY)
    positions.push({ x, y })
    if (x + desk.width > classroomStage.width || y + desk.height > classroomStage.height) return undefined
    for (let previous = 0; previous < index; previous += 1) {
      if (deskOverlaps(desk, desks[previous], { x, y }, positions[previous])) return undefined
    }
  }
  return positions
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
