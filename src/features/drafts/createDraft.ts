import { generateDeskGrid } from '../../domain/seating'
import { isRegularGridUsable, regularDeskSpec } from '../../domain/layout'
import type { EntityId, LayoutDraft } from '../../domain/types'

export interface DraftFactoryDependencies {
  createId(): EntityId
  now(): string
}

const browserDependencies: DraftFactoryDependencies = {
  createId: () => globalThis.crypto.randomUUID(),
  now: () => new Date().toISOString(),
}

export function createDefaultDraft(
  classId: EntityId,
  configuration: { rows?: number; desksPerRow?: number; capacity?: 1 | 2 } = {},
  dependencies: DraftFactoryDependencies = browserDependencies,
): LayoutDraft {
  const rows = configuration.rows ?? 2
  const desksPerRow = configuration.desksPerRow ?? 3
  if (!isRegularGridUsable(rows, desksPerRow)) throw new RangeError('普通座位数量超出画布可用范围')
  const timestamp = dependencies.now()
  return {
    id: dependencies.createId(),
    classId,
    podium: { x: 355, y: 22, width: 185, height: 58 },
    desks: generateDeskGrid(
      {
        classId,
        rows,
        desksPerRow,
        capacity: configuration.capacity ?? regularDeskSpec.capacity,
        originX: 75,
        originY: 145,
        deskWidth: regularDeskSpec.width,
        deskHeight: regularDeskSpec.height,
        horizontalGap: 48,
        verticalGap: 62,
      },
      {
        deskId: () => dependencies.createId(),
        seatId: () => dependencies.createId(),
      },
      timestamp,
    ),
    assignments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
