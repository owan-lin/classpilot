import { describe, expect, it } from 'vitest'
import { shouldReloadForControllerChange } from './PwaUpdatePrompt'

describe('PwaUpdatePrompt controller changes', () => {
  it('does not reload when a page receives its first service-worker controller', () => {
    expect(shouldReloadForControllerChange(null, false)).toBe(false)
  })

  it('reloads once when an already controlled page switches to an update', () => {
    const controller = {} as ServiceWorker
    expect(shouldReloadForControllerChange(controller, false)).toBe(true)
    expect(shouldReloadForControllerChange(controller, true)).toBe(false)
  })
})
