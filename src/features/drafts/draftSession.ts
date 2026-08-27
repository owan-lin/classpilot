import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from '../../domain/history'
import type { ClassRepository, LayoutDraft } from '../../domain/types'

export type DraftListener = (history: HistoryState<LayoutDraft>) => void

/** Coordinates immutable in-memory edits with debounced local-only persistence. */
export class DraftSession {
  private history: HistoryState<LayoutDraft>
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: LayoutDraft | undefined
  private saveChain = Promise.resolve()
  private readonly listeners = new Set<DraftListener>()
  private readonly repository: Pick<ClassRepository, 'saveDraft'>
  private readonly delayMs: number
  private readonly historyLimit: number

  constructor(
    initialDraft: LayoutDraft,
    repository: Pick<ClassRepository, 'saveDraft'>,
    delayMs = 500,
    historyLimit = 100,
  ) {
    this.history = createHistory(initialDraft)
    this.repository = repository
    this.delayMs = delayMs
    this.historyLimit = historyLimit
  }

  get current(): LayoutDraft {
    return structuredClone(this.history.present)
  }

  get canUndo(): boolean {
    return canUndo(this.history)
  }

  get canRedo(): boolean {
    return canRedo(this.history)
  }

  subscribe(listener: DraftListener): () => void {
    this.listeners.add(listener)
    listener(this.history)
    return () => this.listeners.delete(listener)
  }

  update(update: LayoutDraft | ((draft: LayoutDraft) => LayoutDraft)): LayoutDraft {
    const next = typeof update === 'function' ? update(this.current) : update
    this.history = commitHistory(this.history, next, this.historyLimit)
    this.changed()
    return this.current
  }

  undo(): LayoutDraft {
    this.history = undoHistory(this.history)
    this.changed()
    return this.current
  }

  redo(): LayoutDraft {
    this.history = redoHistory(this.history)
    this.changed()
    return this.current
  }

  private changed(): void {
    this.pending = this.current
    for (const listener of this.listeners) listener(this.history)
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), this.delayMs)
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    const draft = this.pending
    this.pending = undefined
    if (!draft) return this.saveChain
    this.saveChain = this.saveChain.then(() => this.repository.saveDraft(draft))
    await this.saveChain
  }

  async dispose(): Promise<void> {
    await this.flush()
    this.listeners.clear()
  }
}
