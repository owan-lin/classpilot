import { describe, expect, it, vi } from 'vitest'
import { createDefaultDraft } from './createDraft'
import { DraftSession } from './draftSession'

describe('DraftSession persistence', () => {
  it('never resurrects an older failed save over a newer queued edit', async () => {
    const draft = createDefaultDraft('class')
    let rejectFirst!: (error: Error) => void
    const firstSave = new Promise<void>((_, reject) => { rejectFirst = reject })
    let calls = 0
    const saved: number[] = []
    const session = new DraftSession(draft, { saveDraft: async (next) => {
      if (++calls === 1) await firstSave
      saved.push(next.desks[0].x)
    } }, 60_000)
    session.update((current) => ({ ...current, desks: current.desks.map((desk) => ({ ...desk, x: 10 })) }))
    const older = session.flush().catch(() => undefined)
    session.update((current) => ({ ...current, desks: current.desks.map((desk) => ({ ...desk, x: 20 })) }))
    const newer = session.flush()
    rejectFirst(new Error('first write failed'))
    await Promise.all([older, newer])
    await session.dispose()
    expect(saved).toEqual([20])
  })

  it('flushes the latest legal layout after rapid updates', async () => {
    const draft = createDefaultDraft('class')
    const saved: typeof draft[] = []
    const session = new DraftSession(draft, { saveDraft: async (next) => { saved.push(structuredClone(next)) } }, 0)
    const moved = session.update((current) => ({ ...current, desks: current.desks.map((desk, index) => index === 0 ? { ...desk, x: 50, y: 125 } : desk) }))
    session.update((current) => ({ ...current, desks: current.desks.map((desk, index) => index === 0 ? { ...desk, x: 75, y: 150 } : desk) }))
    await session.flush()
    expect(saved.at(-1)?.desks[0]).toMatchObject({ id: moved.desks[0].id, x: 75, y: 150 })
    expect(session.current.desks[0]).toMatchObject({ x: 75, y: 150 })
    await session.dispose()
  })

  it('continues persisting later changes after a failed save', async () => {
    const draft = createDefaultDraft('class')
    const saved: number[] = []
    let attempts = 0
    const session = new DraftSession(draft, {
      saveDraft: async (next) => {
        attempts += 1
        if (attempts === 1) throw new Error('temporary storage failure')
        saved.push(next.desks[0].x)
      },
    }, 60_000)
    session.update((current) => ({ ...current, desks: current.desks.map((desk, index) => index === 0 ? { ...desk, x: 10 } : desk) }))
    await expect(session.flush()).rejects.toThrow('temporary storage failure')
    session.update((current) => ({ ...current, desks: current.desks.map((desk, index) => index === 0 ? { ...desk, x: 20 } : desk) }))
    await expect(session.flush()).resolves.toBeUndefined()
    expect(saved).toEqual([20])
    await session.dispose()
  })

  it('handles timer-triggered failures and retains the draft for a manual retry', async () => {
    vi.useFakeTimers()
    try {
      const draft = createDefaultDraft('class')
      let attempts = 0
      const saved: number[] = []
      const saveErrors: unknown[] = []
      const unhandled = vi.fn()
      const listener = (event: PromiseRejectionEvent) => unhandled(event.reason)
      globalThis.addEventListener('unhandledrejection', listener)
      const session = new DraftSession(draft, {
        saveDraft: async (next) => {
          attempts += 1
          if (attempts === 1) throw new Error('temporary storage failure')
          saved.push(next.desks[0].x)
        },
      }, 5)
      session.subscribeSaveError((error) => saveErrors.push(error))
      session.update((current) => ({ ...current, desks: current.desks.map((desk, index) => index === 0 ? { ...desk, x: 40 } : desk) }))
      await vi.advanceTimersByTimeAsync(5)
      await Promise.resolve()
      expect(unhandled).not.toHaveBeenCalled()
      expect(saveErrors).toHaveLength(1)
      expect(saveErrors[0]).toBeInstanceOf(Error)
      await expect(session.flush()).resolves.toBeUndefined()
      expect(saved).toEqual([40])
      globalThis.removeEventListener('unhandledrejection', listener)
      await session.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('dispose flushes a pending debounced change', async () => {
    const draft = createDefaultDraft('class')
    const saved: number[] = []
    const session = new DraftSession(draft, { saveDraft: async (next) => { saved.push(next.desks[0].x) } }, 60_000)
    session.update((current) => ({ ...current, desks: current.desks.map((desk, index) => index === 0 ? { ...desk, x: 99 } : desk) }))
    await session.dispose()
    expect(saved).toEqual([99])
  })
})
