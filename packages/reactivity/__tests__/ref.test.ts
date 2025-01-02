import { effect } from '../src/effect'
import { isReactive, isShallow, reactive } from '../src/reactive'
import { isRef, ref, shallowRef, unref } from '../src/ref'

describe('reactivity/ref', () => {
  it('should hold a value', () => {
    const a = ref(1)
    expect(a.value).toBe(1)
    a.value = 2
    expect(a.value).toBe(2)
  })

  it('should be reactive', () => {
    const a = ref(1)
    let dummy
    const fn = vi.fn(() => {
      dummy = a.value
    })
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)
    a.value = 2
    expect(fn).toHaveBeenCalledTimes(2)
    expect(dummy).toBe(2)
    // 相同的值不应该触发更新
    a.value = 2
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('ref wrapped in reactive should not track internal _value access', () => {
    const a = ref(1)
    const b = reactive(a)
    let dummy
    const fn = vi.fn(() => {
      // 将同时监听 b.value 和 a.value
      dummy = b.value
    })
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    // mutating a.value should only trigger effect once
    // 更改 a.value 应该只会触发一次
    a.value = 3
    expect(fn).toHaveBeenCalledTimes(2)
    expect(dummy).toBe(3)

    // 更改 b.value 应该触发两次 (一次是 a.value 的更改，一次是 b.value 的更改)
    b.value = 5
    expect(fn).toHaveBeenCalledTimes(4)
    expect(dummy).toBe(5)
  })

  it('should make nested properties reactive', () => {
    const a = ref({
      count: 1,
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    a.value.count = 2
    expect(dummy).toBe(2)
  })

  it('should work without initial value', () => {
    const a = ref()
    let dummy
    effect(() => {
      dummy = a.value
    })
    expect(dummy).toBe(undefined)
    a.value = 2
    expect(dummy).toBe(2)
  })

  it('isRef', () => {
    expect(isRef(ref(1))).toBe(true)

    expect(isRef(0)).toBe(false)
    expect(isRef(1)).toBe(false)
    // 结构像 ref 的对象，但不是 ref
    expect(isRef({ value: 0 })).toBe(false)
  })

  it('unref', () => {
    expect(unref(1)).toBe(1)
    expect(unref(ref(1))).toBe(1)
  })

  it('shallowRef', () => {
    const sref = shallowRef({ a: 1 })
    expect(isReactive(sref.value)).toBe(false)

    let dummy
    effect(() => {
      dummy = sref.value.a
    })
    expect(dummy).toBe(1)

    sref.value = { a: 2 }
    expect(isReactive(sref.value)).toBe(false)
    expect(dummy).toBe(2)
  })

  it('shallowRef isShallow', () => {
    expect(isShallow(shallowRef({ a: 1 }))).toBe(true)
  })
})
