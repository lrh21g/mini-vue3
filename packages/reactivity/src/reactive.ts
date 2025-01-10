import {
  def,
  hasOwn,
  isObject,
  toRawType,
} from '@mini-vue3/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers,
} from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowReactiveCollectionHandlers,
  shallowReadonlyCollectionHandlers,
} from './collectionHandlers'
import { ReactiveFlags } from './constants'

enum TargetType {
  // 无效对象
  INVALID = 0,
  // 普通对象
  COMMON = 1,
  // 集合对象
  COLLECTION = 2,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

// 获取对象类型
function getTargetType(value) {
  // 如果对象不需要代理或者是不可扩展对象，则不需要代理
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

// 用于缓存响应式对象
// WeakMap ： 键值对的集合，其中的键必须是对象或 Symbol ，且值可以是任意的 JavaScript 类型，并且不会创建对它的键的强引用。
// 一个对象作为 WeakMap 的键存在，不会阻止该对象被垃圾回收。一旦一个对象作为键被回收，那么在 WeakMap 中相应的值便成为了进行垃圾回收的候选对象，只要它们没有其他的引用存在。
// see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
export const reactiveMap = new WeakMap()
export const readonlyMap = new WeakMap()
export const shallowReactiveMap = new WeakMap()
export const shallowReadonlyMap = new WeakMap()

/**
 * 创建响应式对象
 * @param target 需要代理的原对象
 * @param isReadonly 当前创建的响应式对象是否只读
 * @param proxyMap 缓存当前响应式对象
 * @param baseHandlers 普通对象的拦截处理
 */
export function createReactiveObject(target, isReadonly, proxyMap, baseHandlers, collectionHandlers) {
  // 如果当前对象是非只读响应式代理对象，则直接返回
  if (
    target[ReactiveFlags.RAW]
    && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  // 如果不是对象，则直接返回
  if (!isObject(target)) {
    return target
  }

  // 判断当前的对象是否存在proxy，存在就不必创建直接返回
  const existProxy = proxyMap.get(target)
  if (existProxy) {
    return existProxy
  }

  // 获取当前对象的类型
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    // 如果当前的对象是无效的对象，则直接返回（例如函数、其他对象）
    return target
  }

  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers,
  )
  // 缓存当前响应式对象
  proxyMap.set(target, proxy)
  return proxy
}

export function reactive(target) {
  return createReactiveObject(
    target,
    false,
    reactiveMap,
    mutableHandlers,
    mutableCollectionHandlers,
  )
}

export function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyMap,
    readonlyHandlers,
    readonlyCollectionHandlers,
  )
}

export function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveMap,
    shallowReactiveHandlers,
    shallowReactiveCollectionHandlers,
  )
}

export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyMap,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
  )
}

export const toReactive = val => isObject(val) ? reactive(val) : val
export const toReadonly = val => isObject(val) ? readonly(val) : val

// 转换为普通对象
export function toRaw(observed) {
  const raw = observed && (observed as any)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

// 标记对象不可被转为代理对象，返回该对象本身
export function markRaw(val) {
  // Object.isExtensible() : 判断一个对象是否是可扩展的（是否可以在它上面添加新的属性）
  // 可以使用 Object.preventExtensions()、Object.seal()、Object.freeze() 或 Reflect.preventExtensions() 中的任一方法将对象标记为不可扩展。
  if (!hasOwn(val, ReactiveFlags.SKIP) && Object.isExtensible(val)) {
    def(val, ReactiveFlags.SKIP, true)
  }
  return val
}

export function isReactive(val) {
  if (isReadonly(val)) {
    return isReactive(val[ReactiveFlags.RAW])
  }
  return !!(val && val[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(val) {
  return !!(val && val[ReactiveFlags.IS_READONLY])
}

export function isShallow(val) {
  return !!(val && val[ReactiveFlags.IS_SHALLOW])
}

export function isProxy(val) {
  return !!(val && val[ReactiveFlags.RAW])
}
