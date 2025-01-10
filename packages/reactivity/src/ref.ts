import { hasChanged, isArray, isFunction, isObject } from '@mini-vue3/shared'
import { ReactiveFlags } from './constants'
import { createDep } from './dep'
import { isTracking, trackEffects, triggerEffects } from './effect'
import { isReactive, isReadonly, isShallow, toRaw, toReactive } from './reactive'

class RefImpl {
  // 存储当前 ref 的依赖
  public dep
  // 存储 ref 的响应式值，提供给外部访问。该值通过 reactive 处理（如果不是浅层 ref）
  public _value
  // 存储原始的值，用于比较新的值与旧值是否发生了变化。
  private _rawValue

  // 标识当前对象是一个 ref 类型
  public readonly [ReactiveFlags.IS_REF] = true
  // 标识当前 ref 非浅层的 (shallow)
  // 浅层 ref 不会对对象进行深度响应式转换，只是保留原始值
  public readonly [ReactiveFlags.IS_SHALLOW] = false

  constructor(
    value, // 传入的值，可能是一个对象、数组或者基本类型
    isShallow, // 是否是浅层代理
  ) {
    // 保存原始值
    // 如果是浅层，则直接返回原始值；否则，使用 toRaw(value) 移除响应式处理，得到原始值
    this._rawValue = isShallow ? value : toRaw(value)
    // 保存响应式值
    // 如果是浅层，则返回原值；否则，使用 toReactive(value) 对值进行深度响应式处理
    this._value = isShallow ? value : toReactive(value)
    // 保存是否是浅层代理
    this[ReactiveFlags.IS_SHALLOW] = isShallow
  }

  get value() {
    // 在 ref 被访问时，收集依赖
    trackRefValue(this)
    return this._value
  }

  set value(newValue) {
    // 获取旧值（即未经过响应式处理的原始值）
    const oldValue = this._rawValue
    // 用于判断是否使用 newValue 原值
    const useDirectValue = this[ReactiveFlags.IS_SHALLOW] || isShallow(newValue) || isReadonly(newValue)

    newValue = useDirectValue ? newValue : toRaw(newValue)

    // 判断是否值是否改变，如果改变，则触发依赖更新
    if (hasChanged(newValue, oldValue)) {
      // 更新原始值
      this._rawValue = newValue
      // 更新响应式值
      this._value = useDirectValue ? newValue : toReactive(newValue)
      // 触发副作用更新
      triggerRefValue(this)
    }
  }
}

// ObjectRefImpl 是针对对象的某个属性而存在，用于对对象某个属性的值进行代理和访问。
class ObjectRefImpl {
  // 标识当前对象是一个 ref 类型
  public readonly [ReactiveFlags.IS_REF] = true
  // 存储 ObjectRefImpl 的值
  public _value

  constructor(
    // ObjectRefImpl 关联的对象，通过该对象来访问和操作特定的属性
    private readonly _object,
    // 要操作的对象属性的键名
    public readonly _key,
    // 如果对象的属性 key 没有定义，_defaultValue 将作为默认值返回
    public readonly _defaultValue,
  ) {}

  get value() {
    // 从 _object 中获取属性值
    // 如果该属性存在，则返回其值
    // 如果该属性不存在（即为 undefined），则返回 _defaultValue
    const val = this._object[this._key]
    return this._value = val === undefined ? this._defaultValue : val
  }

  set value(newValue) {
    // 直接修改对象属性的值
    this._object[this._key] = newValue
  }
}

// GetterRefImpl 提供只读的 ref ，其值通过 getter 函数动态计算而来
// 可以根据其他响应式数据的变化，动态计算出一个新值，而无需直接修改该 ref 的值
// 适用于那些需要基于其他数据计算出衍生值的场景，且这种衍生值是只读的
class GetterRefImpl {
  // 标识当前对象是一个 ref 类型
  public readonly [ReactiveFlags.IS_REF] = true
  // 标识当前 ref 是只读的
  public readonly [ReactiveFlags.IS_READONLY] = true
  // 存储 getter 计算的结果。每次访问 value 时，都会通过 _getter() 计算并返回一个新的值。
  public _value

  constructor(
    // 接收 getter 函数，将在每次访问 value 时被调用，用于计算并返回实际的值
    private readonly _getter,
  ) {}

  get value() {
    return (this._value = this._getter())
  }
}

// 用于将对象的某个属性转换为 ref 类型。
function propertyToRef(source, key, defaultValue?) {
  const val = source[key]
  return isRef(val) ? val : (new ObjectRefImpl(source, key, defaultValue))
}

// 收集 ref 依赖
export function trackRefValue(ref) {
  // 判断是否处于依赖收集的状态。
  // 只有在当前 effect 执行时，依赖才会被收集。否则，不进行任何处理。
  if (isTracking()) {
    // ref 对象会持有一个 dep（Set 类型）。dep 存储了依赖当前 ref 的 effect。如果 ref 没有 dep（即首次访问），会为其创建一个新的 Set。
    const dep = ref.dep || (ref.dep = new Set())
    // 将当前正在执行的 effect 添加到 ref 的 dep 中，以便当 ref 的值发生变化时能够触发相关的 effect
    trackEffects(dep)
  }
}

// 触发 ref 依赖更新
export function triggerRefValue(ref) {
  // createDep(ref.dep) 创建一个新的依赖集合 dep，这个集合包含了所有依赖该 ref 的 effect
  // createDep 会确保每个 dep 是一个新的引用，从而避免触发依赖时的循环调用
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

export function toRef(source, key?, defaultValue?) {
  if (isRef(source)) {
    return source
  }
  else if (isFunction(source)) {
    return new GetterRefImpl(source)
  }
  else if (isObject(source) && arguments.length > 1) {
    return propertyToRef(source, key!, defaultValue)
  }
  else {
    return ref(source)
  }
}

export function toRefs(object) {
  const ret = isArray(object) ? Array.from({ length: object.length }) : {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}

export function isRef(val) {
  return val ? val[ReactiveFlags.IS_REF] === true : false
}

export function unref(ref) {
  return isRef(ref) ? ref.value : ref
}

// 用于浅层解包的代理处理器
const shallowUnwrapHandlers = {
  get(target, key, receiver) {
    return key === ReactiveFlags.RAW
      ? target
      : unref(Reflect.get(target, key, receiver))
  },
  set(target, key, value, receiver) {
    const oldValue = target[key]

    if (isRef(oldValue) && !isRef(value)) {
      // 如果 oldValue 是一个 ref ，value 不是 ref，则直接设置 value

      oldValue.value = value
      return true
    }
    else {
      return Reflect.set(target, key, value, receiver)
    }
  },
}

export function proxyRefs(objectWithRefs) {
  return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers)
}

export function toValue(source) {
  return isFunction(source) ? source() : unref(source)
}
