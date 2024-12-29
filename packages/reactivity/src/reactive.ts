import { mutableHandlers, readonlyHandlers } from './baseHandlers'

// 用于缓存响应式对象
// WeakMap ： 键值对的集合，其中的键必须是对象或 Symbol ，且值可以是任意的 JavaScript 类型，并且不会创建对它的键的强引用。
// 一个对象作为 WeakMap 的键存在，不会阻止该对象被垃圾回收。一旦一个对象作为键被回收，那么在 WeakMap 中相应的值便成为了进行垃圾回收的候选对象，只要它们没有其他的引用存在。
// see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
export const reactiveMap = new WeakMap()
export const readonlyMap = new WeakMap()

/**
 * 创建响应式对象
 * @param target 需要代理的原对象
 * @param isReadonly 当前创建的响应式对象是否只读
 * @param proxyMap 缓存当前响应式对象
 * @param baseHandlers 普通对象的拦截处理
 */
export function createReactiveObject(target, isReadonly, proxyMap, baseHandlers) {
  const proxy = new Proxy(
    target,
    baseHandlers,
  )
  // 缓存当前响应式对象
  proxyMap.set(target, proxy)
  return proxy
}

export function reactive(target) {
  return createReactiveObject(target, false, reactiveMap, mutableHandlers)
}

export function readonly(target) {
  return createReactiveObject(target, true, readonlyMap, readonlyHandlers)
}
