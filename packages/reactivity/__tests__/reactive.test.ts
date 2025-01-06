import { isProxy, isReactive, markRaw, reactive, readonly, shallowReactive, shallowReadonly, toRaw } from '../src/reactive'

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

  it('toRaw', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(toRaw(observed)).toBe(original)
    expect(toRaw(original)).toBe(original)
  })

  it('toRaw on object using reactive as prototype', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    const inherted = Object.create(observed)
    expect(toRaw(inherted)).toBe(inherted)
  })

  it('toRaw on user Proxy wrapping reactive', () => {
    const original = {}
    const re = reactive(original)
    const obj = new Proxy(re, {})
    const raw = toRaw(obj)
    expect(raw).toBe(original)
  })

  it('markRaw', () => {
    const obj = reactive({
      foo: { a: 1 },
      bar: markRaw({ b: 2 }),
    })
    expect(isReactive(obj.foo)).toBe(true)
    expect(isReactive(obj.bar)).toBe(false)
  })

  it('markRaw should skip non-extensible objects', () => {
    const obj = Object.seal({ foo: 1 })
    expect(() => markRaw(obj)).not.toThrowError()
  })

  it('markRaw should not redefine on an marked object', () => {
    const obj = markRaw({ foo: 1 })
    const raw = markRaw(obj)
    expect(raw).toBe(obj)
    expect(() => markRaw(obj)).not.toThrowError()
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
