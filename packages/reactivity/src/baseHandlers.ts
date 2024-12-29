import { extend } from '@mini-vue3/shared'
import { track, trigger } from './effect'
import { ReactiveFlags } from './reactive'

// 创建拦截读取操作的捕获器
function createGetter(isReadonly = false) {
  return function get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    }
    else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    }

    const res = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      track(target, 'get', key)
    }

    return res
  }
}

// 创建拦截设置操作的捕获器
function createSetter() {
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

// 普通的 setter
const set = createSetter()

export const mutableHandlers = {
  get,
  set,
}

export const readonlyHandlers = extend(
  { get: readonlyGet },
  readOnlyObj,
)
