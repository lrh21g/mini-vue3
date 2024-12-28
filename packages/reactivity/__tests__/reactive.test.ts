import { describe, expect, it } from 'vitest'
import { reactive } from '../src/reactive'

describe('reactive', () => {
  it('object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)

    expect(observed).not.toBe(original)
    // expect(isReactive(observed)).toBe(true)
    // expect(isReactive(original)).toBe(false)
    expect(observed.foo).toBe(1)
    expect('foo' in observed).toBe(true)
    expect(Object.keys(observed)).toEqual(['foo'])
  })
})
