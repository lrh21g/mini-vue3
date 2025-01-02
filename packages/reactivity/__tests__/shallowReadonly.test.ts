import { isReactive, isReadonly, readonly, shallowReadonly } from '../src/reactive'

describe('reactivity/shallowReadonly', () => {
  it('should not make non-reactive properties reactive', () => {
    const props = shallowReadonly({ n: { foo: 1 } })
    expect(isReactive(props.n)).toBe(false)
  })

  it('should make root level properties readonly', () => {
    const props = shallowReadonly({ n: 1 })
    props.n = 2
    expect(props.n).toBe(1)
  })

  it('should NOT make nested properties readonly', () => {
    const props = shallowReadonly({ n: { foo: 1 } })

    props.n.foo = 2
    expect(props.n.foo).toBe(2)
  })

  it('should differentiate from normal readonly calls', () => {
    const original = { foo: {} }
    const shallowProxy = shallowReadonly(original)
    const reactiveProxy = readonly(original)
    expect(shallowProxy).not.toBe(reactiveProxy)
    expect(isReadonly(shallowProxy.foo)).toBe(false)
    expect(isReadonly(reactiveProxy.foo)).toBe(true)
  })
})
