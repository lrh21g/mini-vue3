import { effect } from '../src/effect'
import { isProxy, isReactive, markRaw, reactive, readonly, shallowReactive, shallowReadonly, toRaw } from '../src/reactive'
import { isRef, ref } from '../src/ref'

describe('reactivity/reactive', () => {
  it('object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)
    // get
    expect(observed.foo).toBe(1)
    // has
    expect('foo' in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['foo'])
  })

  it('proto', () => {
    const obj = {}
    const reactiveObj = reactive(obj)
    expect(isReactive(reactiveObj)).toBe(true)
    // read prop of reactiveObject will cause reactiveObj[prop] to be reactive
    // eslint-disable-next-line no-proto, no-restricted-properties, unused-imports/no-unused-vars
    const prototype = reactiveObj.__proto__
    const otherObj = { data: ['a'] }
    expect(isReactive(otherObj)).toBe(false)
    const reactiveOther = reactive(otherObj)
    expect(isReactive(reactiveOther)).toBe(true)
    expect(reactiveOther.data[0]).toBe('a')
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

  it('observing subtypes of IterableCollections(Map, Set)', () => {
    // subtypes of Map
    class CustomMap extends Map {}
    const cmap = reactive(new CustomMap())

    expect(cmap).toBeInstanceOf(Map)
    expect(isReactive(cmap)).toBe(true)

    cmap.set('key', {})
    expect(isReactive(cmap.get('key'))).toBe(true)

    // subtypes of Set
    class CustomSet extends Set {}
    const cset = reactive(new CustomSet())

    expect(cset).toBeInstanceOf(Set)
    expect(isReactive(cset)).toBe(true)

    let dummy
    effect(() => (dummy = cset.has('value')))
    expect(dummy).toBe(false)
    cset.add('value')
    expect(dummy).toBe(true)
    cset.delete('value')
    expect(dummy).toBe(false)
  })

  it('observing subtypes of WeakCollections(WeakMap, WeakSet)', () => {
    // subtypes of WeakMap
    class CustomMap extends WeakMap {}
    const cmap = reactive(new CustomMap())

    expect(cmap).toBeInstanceOf(WeakMap)
    expect(isReactive(cmap)).toBe(true)

    const key = {}
    cmap.set(key, {})
    expect(isReactive(cmap.get(key))).toBe(true)

    // subtypes of WeakSet
    class CustomSet extends WeakSet {}
    const cset = reactive(new CustomSet())

    expect(cset).toBeInstanceOf(WeakSet)
    expect(isReactive(cset)).toBe(true)

    let dummy
    effect(() => (dummy = cset.has(key)))
    expect(dummy).toBe(false)
    cset.add(key)
    expect(dummy).toBe(true)
    cset.delete(key)
    expect(dummy).toBe(false)
  })

  it('observed value should proxy mutations to original (Object)', () => {
    const original: any = { foo: 1 }
    const observed = reactive(original)
    // set
    observed.bar = 1
    expect(observed.bar).toBe(1)
    expect(original.bar).toBe(1)
    // delete
    delete observed.foo
    expect('foo' in observed).toBe(false)
    expect('foo' in original).toBe(false)
  })

  it('original value change should reflect in observed value (Object)', () => {
    const original: any = { foo: 1 }
    const observed = reactive(original)
    // set
    original.bar = 1
    expect(original.bar).toBe(1)
    expect(observed.bar).toBe(1)
    // delete
    delete original.foo
    expect('foo' in original).toBe(false)
    expect('foo' in observed).toBe(false)
  })

  it('setting a property with an unobserved value should wrap with reactive', () => {
    const observed = reactive({})
    const raw = {}
    observed.foo = raw
    expect(observed.foo).not.toBe(raw)
    expect(isReactive(observed.foo)).toBe(true)
  })

  it('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    const observed2 = reactive(observed)
    expect(observed2).toBe(observed)
  })

  it('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    const observed2 = reactive(original)
    expect(observed2).toBe(observed)
  })

  it('should not pollute original object with Proxies', () => {
    const original: any = { foo: 1 }
    const original2 = { bar: 2 }
    const observed = reactive(original)
    const observed2 = reactive(original2)
    observed.bar = observed2
    expect(observed.bar).toBe(observed2)
    expect(original.bar).toBe(original2)
  })

  it('mutation on objects using reactive as prototype should not trigger', () => {
    const observed = reactive({ foo: 1 })
    const original = Object.create(observed)
    let dummy
    effect(() => (dummy = original.foo))
    expect(dummy).toBe(1)
    observed.foo = 2
    expect(dummy).toBe(2)
    original.foo = 3
    expect(dummy).toBe(2)
    original.foo = 4
    expect(dummy).toBe(2)
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

  it('should not unwrap Ref<T>', () => {
    const observedNumberRef = reactive(ref(1))
    const observedObjectRef = reactive(ref({ foo: 1 }))

    expect(isRef(observedNumberRef)).toBe(true)
    expect(isRef(observedObjectRef)).toBe(true)
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
