import { describe, expect, it } from 'vitest'
import {
  defineBackupCodecContract,
  defineCrossTargetBackupContract,
} from './backup.contract'
import { defineSeatingOperationsContract } from './seating.contract'

describe('domain contract wiring', () => {
  it('keeps the property contract harnesses loadable until implementations land', () => {
    expect(defineSeatingOperationsContract).toBeTypeOf('function')
    expect(defineBackupCodecContract).toBeTypeOf('function')
    expect(defineCrossTargetBackupContract).toBeTypeOf('function')
  })

  it.todo('rejects a duplicate student number within the same class')
  it.todo('reports insufficient seats without dropping or duplicating a student')
  it.todo('supports an empty class without inventing an assignment')
  it.todo('restores an immutable snapshot by creating a new draft')
  it.todo('round-trips a full backup across PWA and Tauri repositories')
  it.todo('wires the seating operation implementation into defineSeatingOperationsContract')
  it.todo('wires the backup codec implementation into defineBackupCodecContract')
  it.todo('derives and validates backup checksums after the checksum interface is defined')
  it.todo('wires independent PWA and Tauri repositories into defineCrossTargetBackupContract')
})
