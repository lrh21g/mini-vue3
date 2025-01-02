import { isProxy, isReactive, reactive, readonly, shallowReactive, shallowReadonly } from '../src/reactive'

describe('reactivity/reactive', () => {
  it('object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)

    expect(observed).not.toBe(original)

    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)

    expect(observed.foo).toBe(1)
    expect('foo' in observed).toBe(true)
    expect(Object.keys(observed)).toEqual(['foo'])
  })

  it('nested reactive', () => {
    const original = {
      nested: {
        foo: 1,
      },
      array: [{ bar: 2 }],
    }
    const observed = reactive(original)

    expect(isReactive(observed.nested)).toBe(true)
    expect(isReactive(observed.array)).toBe(true)
    expect(isReactive(observed.array[0])).toBe(true)
  })

  it('isProxy', () => {
    const foo = {}
    expect(isProxy(foo)).toBe(false)

    const fooRe = reactive(foo)
    expect(isProxy(fooRe)).toBe(true)

    const fooSRe = shallowReactive(foo)
    expect(isProxy(fooSRe)).toBe(true)

    const barRl = readonly(foo)
    expect(isProxy(barRl)).toBe(true)

    const barSRl = shallowReadonly(foo)
    expect(isProxy(barSRl)).toBe(true)
  })
})
