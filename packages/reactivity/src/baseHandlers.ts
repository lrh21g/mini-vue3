import { extend, isObject } from '@mini-vue3/shared'
import { track, trigger } from './effect'
import { reactive, ReactiveFlags, reactiveMap, readonly, readonlyMap, shallowReactiveMap, shallowReadonlyMap } from './reactive'

// 创建拦截读取操作的捕获器
function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    }
    else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    }
    else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow
    }
    else if (key === ReactiveFlags.RAW) {
      // 如果当前 receiver 和 target 所在的响应式匹配（shallowReadonlyMap、readonlyMap 等保存了代理对象的映射），则返回 target 原始对象
      // 如果当前 receiver 和 target 拥有相同的原型链，则返回 target 原始对象
      if (
        receiver
        === (isReadonly
          ? isShallow
            ? shallowReadonlyMap
            : readonlyMap
          : isShallow
            ? shallowReactiveMap
            : reactiveMap
        ).get(target)
        || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target
      }
      return
    }

    const res = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      // 非只读，则进行依赖收集
      track(target, 'get', key)
    }

    // 浅层代理直接返回， Proxy 只代理一层（浅层）
    if (isShallow) {
      return res
    }

    // 如果属性为对象，则深度代理
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

// 创建拦截设置操作的捕获器
function createSetter(_isShallow = false) {
  return function set(target, key, value, receiver) {
    const res = Reflect.set(target, key, value, receiver)

    trigger(target, 'set', key)

    return res
  }
}

// 只读的捕获器相关
const readOnlyObj = {
  set: (target, key, value) => {
    console.warn(`readonly API 不能设置 ${key} 为 ${value}`)

    // 设置属性值操作的捕获器
    // set() 方法应当返回一个布尔值。
    // > 返回 true 代表属性设置成功。
    // > 在严格模式下，如果 set() 方法返回 false，那么会抛出一个 TypeError 异常。
    // see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set
    return true
  },
}

// 普通的 getter
const get = createGetter()
// 只读的 getter
const readonlyGet = createGetter(true)
// 浅层的 getter
const shallowGet = createGetter(false, true)
// 只读浅层的 getter
const shallowReadonlyGet = createGetter(true, true)

// 普通的 setter
const set = createSetter()
// 浅层的 setter
const shallowSet = createSetter(true)

export const mutableHandlers = {
  get,
  set,
}

export const readonlyHandlers = extend(
  { get: readonlyGet },
  readOnlyObj,
)

export const shallowReactiveHandlers = {
  get: shallowGet,
  set: shallowSet,
}

export const shallowReadonlyHandlers = extend(
  { get: shallowReadonlyGet },
  readOnlyObj,
)
