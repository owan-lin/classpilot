import { describe, expect, it } from 'vitest'
import { createDefaultDraft } from './createDraft'
import { DraftSession } from './draftSession'

describe('DraftSession persistence', () => {
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
})
