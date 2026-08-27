import { generateDeskGrid } from '../../domain/seating'
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
  dependencies: DraftFactoryDependencies = browserDependencies,
): LayoutDraft {
  const timestamp = dependencies.now()
  return {
    id: dependencies.createId(),
    classId,
    podium: { x: 355, y: 22, width: 185, height: 58 },
    desks: generateDeskGrid(
      {
        classId,
        rows: 2,
        desksPerRow: 3,
        capacity: 2,
        originX: 75,
        originY: 145,
        deskWidth: 190,
        deskHeight: 112,
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
