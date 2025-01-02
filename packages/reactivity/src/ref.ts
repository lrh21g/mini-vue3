import { hasChanged } from '@mini-vue3/shared'
import { ReactiveFlags } from './constants'
import { createDep } from './dep'
import { isTracking, trackEffects, triggerEffects } from './effect'
import { isReadonly, isShallow, toRaw, toReactive } from './reactive'

class RefImpl {
  // 用于存储当前 ref 的依赖
  public dep
  public _value
  private _rawValue

  // 用于表示为 ref 实例
  public readonly [ReactiveFlags.IS_REF] = true
  public readonly [ReactiveFlags.IS_SHALLOW] = false

  constructor(value, isShallow) {
    this._rawValue = isShallow ? value : toRaw(value)
    // 如果是浅层，则返回原值；如果是深层且为对象，则使用 reactive 进行深度转换
    this._value = isShallow ? value : toReactive(value)
    this[ReactiveFlags.IS_SHALLOW] = isShallow
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newValue) {
    const oldValue = this._rawValue
    const useDirectValue = this[ReactiveFlags.IS_SHALLOW] || isShallow(newValue) || isReadonly(newValue)

    newValue = useDirectValue ? newValue : toRaw(newValue)

    // 判断是否值是否改变，如果改变，则触发依赖更新
    if (hasChanged(newValue, oldValue)) {
      this._rawValue = newValue
      this._value = useDirectValue ? newValue : toReactive(newValue)
      triggerRefValue(this)
    }
  }
}

// 收集 ref 依赖
export function trackRefValue(ref) {
  // 判断是否需要收集，需要收集，则触发依赖收集
  if (isTracking()) {
    const dep = ref.dep || (ref.dep = new Set())
    trackEffects(dep)
  }
}

// 触发 ref 依赖更新
export function triggerRefValue(ref) {
  // createDep 与 cleanupEffect 配合使用，直接重新创建一个引用，避免循环执行
  triggerEffects(createDep(ref.dep))
}

function createRef(rawValue, isShallow = false) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, isShallow)
}
export function ref(value?) {
  return createRef(value)
}

export function shallowRef(value) {
  return createRef(value, true)
}

export function isRef(val) {
  return val ? val[ReactiveFlags.IS_REF] === true : false
}

export function unref(ref) {
  return isRef(ref) ? ref.value : ref
}
