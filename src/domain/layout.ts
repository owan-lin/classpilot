import type { DeskRecord, LayoutDraft } from "./types";

export const regularDeskSpec = {
  width: 200,
  height: 105,
  capacity: 2 as const,
} as const;
export const specialDeskSpec = {
  width: 120,
  height: 82,
  capacity: 1 as const,
} as const;

export interface ClassroomStage {
  width: number;
  height: number;
  grid: number;
  minY: number;
  originX: number;
  originY: number;
  gapX: number;
  gapY: number;
  sideGap: number;
  /** Space reserved for the row labels before the left overflow wing. */
  rowLabelGutter: number;
  /** Number of desk columns reserved on either side of the regular grid. */
  sideColumnCount: number;
}
export interface DeskPosition {
  x: number;
  y: number;
}
export interface LayoutConfiguration {
  rows: number;
  desksPerRow: number;
  sideDeskCount?: number;
}

const minimumStage = { width: 1000, height: 650 };

/** One source of truth for canvas dimensions and the configured regular-desk grid. */
export function classroomStageFor(
  configuration: LayoutConfiguration = { rows: 2, desksPerRow: 3 },
): ClassroomStage {
  const rows = Math.max(
    1,
    Number.isSafeInteger(configuration.rows) ? configuration.rows : 1,
  );
  const columns = Math.max(
    1,
    Number.isSafeInteger(configuration.desksPerRow)
      ? configuration.desksPerRow
      : 1,
  );
  const grid = 25,
    gapX = 35,
    gapY = 20,
    sideGap = 45,
    rowLabelGutter = 65;
  const overflowCount = Math.max(
    0,
    Number.isSafeInteger(configuration.sideDeskCount)
      ? (configuration.sideDeskCount ?? 0)
      : 0,
  );
  // Overflow desks occupy balanced left/right wings.  Each wing uses at most
  // `rows` vertical slots before growing outward into another column.
  const sideColumnCount =
    overflowCount > 0 ? Math.ceil(overflowCount / (rows * 2)) : 0;
  const wingWidth =
    sideColumnCount * regularDeskSpec.width +
    Math.max(0, sideColumnCount - 1) * gapX;
  const originX = rowLabelGutter + wingWidth + (wingWidth ? sideGap : 0),
    originY = 125;
  return {
    width: Math.max(
      minimumStage.width,
      originX +
        columns * regularDeskSpec.width +
        (columns - 1) * gapX +
        (wingWidth ? sideGap + wingWidth : 0) +
        50,
    ),
    height: Math.max(
      minimumStage.height,
      originY + rows * regularDeskSpec.height + (rows - 1) * gapY + 60,
    ),
    grid,
    minY: 75,
    originX,
    originY,
    gapX,
    gapY,
    sideGap,
    rowLabelGutter,
    sideColumnCount,
  };
}

/** Compatibility default for legacy callers; configured workflows use classroomStageFor. */
export const classroomStage: ClassroomStage = {
  width: 1000,
  height: 650,
  grid: 25,
  minY: 75,
  originX: 50,
  originY: 125,
  gapX: 35,
  gapY: 38,
  sideGap: 45,
  rowLabelGutter: 65,
  sideColumnCount: 0,
};

/** Positive settings always receive an expandable canvas; there is no fixed-canvas cap. */
export function isRegularGridUsable(
  rows: number,
  desksPerRow: number,
): boolean {
  return (
    Number.isSafeInteger(rows) &&
    Number.isSafeInteger(desksPerRow) &&
    rows > 0 &&
    desksPerRow > 0
  );
}
function normalize(value: number): number {
  return Number.isFinite(value) ? value : Number.NaN;
}

export function deskOverlaps(
  first: DeskRecord,
  second: DeskRecord,
  firstPosition: DeskPosition = first,
  secondPosition: DeskPosition = second,
): boolean {
  return (
    firstPosition.x < secondPosition.x + second.width &&
    firstPosition.x + first.width > secondPosition.x &&
    firstPosition.y < secondPosition.y + second.height &&
    firstPosition.y + first.height > secondPosition.y
  );
}

export function isDeskPositionValid(
  draft: Pick<LayoutDraft, "desks">,
  deskId: string,
  position: DeskPosition,
  stage: ClassroomStage = classroomStage,
): boolean {
  const desk = draft.desks.find((item) => item.id === deskId);
  if (!desk) return false;
  const x = normalize(position.x),
    y = normalize(position.y);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < stage.minY ||
    x + desk.width > stage.width ||
    y + desk.height > stage.height
  )
    return false;
  return draft.desks.every(
    (other) => other.id === deskId || !deskOverlaps(desk, other, { x, y }),
  );
}

/** Free mode permits overlap and the podium area; a 32px grab strip must remain visible. */
export function isFreeDeskPositionVisible(
  desk: DeskRecord,
  position: DeskPosition,
  stage: ClassroomStage = classroomStage,
): boolean {
  void desk;
  const grab = 32;
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x + grab >= 0 &&
    position.y + grab >= 0 &&
    position.x <= stage.width - grab &&
    position.y <= stage.height - grab
  );
}
export function constrainFreeDeskPosition(
  desk: DeskRecord,
  position: DeskPosition,
  stage: ClassroomStage = classroomStage,
): DeskPosition {
  const grab = 32;
  return {
    x: Math.min(stage.width - grab, Math.max(grab - desk.width, position.x)),
    y: Math.min(stage.height - grab, Math.max(grab - desk.height, position.y)),
  };
}
export function snapDeskPosition(
  position: DeskPosition,
  stage: ClassroomStage = classroomStage,
): DeskPosition {
  return {
    x: Math.round(position.x / stage.grid) * stage.grid,
    y: Math.round(position.y / stage.grid) * stage.grid,
  };
}

/**
 * Main grid has exactly rows × desksPerRow regular desks. Any remaining
 * regular desks and every special desk are interleaved across the two side
 * wings. Wings first fill vertically to the configured row count, then add
 * columns outward, so an excess can never become an unbounded left column.
 */
export function alignedDeskPositions(
  desks: readonly DeskRecord[],
  configuration: LayoutConfiguration = { rows: 2, desksPerRow: 4 },
  stage?: ClassroomStage,
): DeskPosition[] {
  const regular = desks.filter((desk) => desk.kind === "regular"),
    special = desks.filter((desk) => desk.kind === "special");
  const mainCount = configuration.rows * configuration.desksPerRow,
    main = regular.slice(0, mainCount),
    extra = regular.slice(mainCount);
  const overflow = [...extra, ...special];
  const resolvedStage =
    stage ??
    classroomStageFor({
      ...configuration,
      sideDeskCount: overflow.length,
    });
  const positions = new Map<string, DeskPosition>();
  main.forEach((desk, index) =>
    positions.set(desk.id, {
      x:
        resolvedStage.originX +
        (index % configuration.desksPerRow) *
          (regularDeskSpec.width + resolvedStage.gapX),
      y:
        resolvedStage.originY +
        Math.floor(index / configuration.desksPerRow) *
          (regularDeskSpec.height + resolvedStage.gapY),
    }),
  );
  const mainRight =
    resolvedStage.originX +
    configuration.desksPerRow * regularDeskSpec.width +
    (configuration.desksPerRow - 1) * resolvedStage.gapX;
  overflow.forEach((desk, index) => {
    const left = index % 2 === 0;
    const sideSlot = Math.floor(index / 2);
    const column = Math.floor(sideSlot / configuration.rows);
    const row = sideSlot % configuration.rows;
    const wingX = left
      ? resolvedStage.originX -
        resolvedStage.sideGap -
        (column + 1) * regularDeskSpec.width -
        column * resolvedStage.gapX
      : mainRight +
        resolvedStage.sideGap +
        column * (regularDeskSpec.width + resolvedStage.gapX);
    positions.set(desk.id, {
      x: wingX + Math.max(0, (regularDeskSpec.width - desk.width) / 2),
      y:
        resolvedStage.originY +
        row * (regularDeskSpec.height + resolvedStage.gapY) +
        Math.max(0, (regularDeskSpec.height - desk.height) / 2),
    });
  });
  return desks.map(
    (desk) => positions.get(desk.id) ?? { x: desk.x, y: desk.y },
  );
}

export function firstFreeDeskPosition(
  draft: Pick<LayoutDraft, "desks">,
  desk: DeskRecord,
  stage: ClassroomStage = classroomStage,
): DeskPosition | undefined {
  const candidateDraft = { desks: [...draft.desks, desk] };
  for (let row = 0; row < Math.ceil(stage.height / 75); row += 1)
    for (let column = 0; column < Math.ceil(stage.width / 100); column += 1) {
      const position = snapDeskPosition(
        { x: 50 + column * 100, y: stage.minY + row * 75 },
        stage,
      );
      if (isDeskPositionValid(candidateDraft, desk.id, position, stage))
        return position;
    }
  return undefined;
}

/** Rebuilds only regular desks. Special seats and their assignments survive unchanged. */
export function rebuildRegularLayout(
  draft: LayoutDraft,
  configuration: { rows: number; desksPerRow: number; capacity: 1 | 2 },
  identities: { deskId(): string; seatId(): string },
  timestamp: string,
): LayoutDraft {
  if (!isRegularGridUsable(configuration.rows, configuration.desksPerRow))
    throw new RangeError("排数和每排桌数必须是正整数");
  const stage = classroomStageFor(configuration),
    regular: DeskRecord[] = [];
  for (let row = 0; row < configuration.rows; row += 1)
    for (let column = 0; column < configuration.desksPerRow; column += 1)
      regular.push({
        id: identities.deskId(),
        classId: draft.classId,
        kind: "regular",
        capacity: configuration.capacity,
        x: stage.originX + column * (regularDeskSpec.width + stage.gapX),
        y: stage.originY + row * (regularDeskSpec.height + stage.gapY),
        width: regularDeskSpec.width,
        height: regularDeskSpec.height,
        seatIds: Array.from(
          { length: configuration.capacity },
          identities.seatId,
        ),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
  const special = draft.desks
    .filter((desk) => desk.kind === "special")
    .map((desk) => ({ ...desk, seatIds: [...desk.seatIds] }));
  const retainedSeats = new Set(special.flatMap((desk) => desk.seatIds));
  return {
    ...draft,
    desks: [...regular, ...special],
    assignments: draft.assignments.filter((assignment) =>
      retainedSeats.has(assignment.seatId),
    ),
  };
}
