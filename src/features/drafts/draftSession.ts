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
export type DraftSaveErrorListener = (error: unknown) => void

/** Coordinates immutable in-memory edits with debounced local-only persistence. */
export class DraftSession {
  private history: HistoryState<LayoutDraft>
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: LayoutDraft | undefined
  private saveChain = Promise.resolve()
  private revision = 0
  private readonly listeners = new Set<DraftListener>()
  private readonly saveErrorListeners = new Set<DraftSaveErrorListener>()
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
    this.revision += 1
    this.pending = this.current
    for (const listener of this.listeners) listener(this.history)
    this.scheduleSave()
  }

  /** Reports background and explicit persistence failures without changing constructor compatibility. */
  subscribeSaveError(listener: DraftSaveErrorListener): () => void {
    this.saveErrorListeners.add(listener)
    return () => this.saveErrorListeners.delete(listener)
  }

  private scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      // Timers have no caller to observe a rejection. Keep the failed draft
      // pending so an explicit flush/dispose or a later edit can retry it.
      void this.flush().catch(() => undefined)
    }, this.delayMs)
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    const draft = this.pending
    const revision = this.revision
    this.pending = undefined
    if (!draft) {
      await this.saveChain
      if (this.pending) await this.flush()
      return
    }
    // Keep serialization, but do not let one transient IndexedDB failure poison
    // every later autosave. The caller that triggered this save still receives it.
    const operation = this.saveChain.then(() => this.repository.saveDraft(draft)).catch((error: unknown) => {
      // A newer edit is a complete draft and must win over this older failed
      // save. Otherwise restore this draft for a deliberate retry.
      if (!this.pending && this.revision === revision) this.pending = draft
      for (const listener of this.saveErrorListeners) listener(error)
      throw error
    })
    this.saveChain = operation.catch(() => undefined)
    await operation
  }

  async dispose(): Promise<void> {
    await this.flush()
    this.listeners.clear()
    this.saveErrorListeners.clear()
  }
}
