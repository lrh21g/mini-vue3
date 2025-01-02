import { isReactive, isShallow, reactive, shallowReactive } from '../src/reactive'

describe('reactivity/shallowReactive', () => {
  it('should not make non-reactive properties reactive', () => {
    const props = shallowReactive({ n: { foo: 1 } })
    expect(isReactive(props.n)).toBe(false)
  })

  it('should keep reactive properties reactive', () => {
    const props: any = shallowReactive({ n: reactive({ foo: 1 }) })
    props.n = reactive({ foo: 2 })
    expect(isReactive(props.n)).toBe(true)
  })

  it('should allow shallow and normal reactive for same target', () => {
    const original = { foo: {} }
    const shallowProxy = shallowReactive(original)
    const reactiveProxy = reactive(original)
    expect(shallowProxy).not.toBe(reactiveProxy)
    expect(isReactive(shallowProxy.foo)).toBe(false)
    expect(isReactive(reactiveProxy.foo)).toBe(true)
  })

  it('isShallow', () => {
    expect(isShallow(shallowReactive({}))).toBe(true)
  })

  it('should respect shallow reactive nested inside reactive on reset', () => {
    const r = reactive({ foo: shallowReactive({ bar: {} }) })
    expect(isShallow(r.foo)).toBe(true)
    expect(isReactive(r.foo.bar)).toBe(false)

    r.foo = shallowReactive({ bar: {} })
    expect(isShallow(r.foo)).toBe(true)
    expect(isReactive(r.foo.bar)).toBe(false)
  })
})
