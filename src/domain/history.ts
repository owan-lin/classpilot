export interface HistoryState<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) freezeDeep(nested)
  }
  return value
}

function immutableCopy<T>(value: T): T {
  return freezeDeep(structuredClone(value))
}

export function createHistory<T>(initialValue: T): HistoryState<T> {
  return freezeDeep({ past: [], present: immutableCopy(initialValue), future: [] })
}

export function commitHistory<T>(
  history: HistoryState<T>,
  nextValue: T,
  limit = 100,
): HistoryState<T> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('History limit must be positive')
  const past = [...history.past, immutableCopy(history.present)].slice(-limit)
  return freezeDeep({ past, present: immutableCopy(nextValue), future: [] })
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return freezeDeep({
    past: history.past.slice(0, -1).map(immutableCopy),
    present: immutableCopy(previous),
    future: [immutableCopy(history.present), ...history.future.map(immutableCopy)],
  })
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const next = history.future[0]
  if (next === undefined) return history
  return freezeDeep({
    past: [...history.past.map(immutableCopy), immutableCopy(history.present)],
    present: immutableCopy(next),
    future: history.future.slice(1).map(immutableCopy),
  })
}

export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0
}
