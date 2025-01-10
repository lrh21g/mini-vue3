import { extend, hasChanged, hasOwn, isMap } from '@mini-vue3/shared'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { ITERATE_KEY, MAP_KEY_ITERATE_KEY, track, trigger } from './effect'
import { isReadonly, isShallow, toRaw, toReactive, toReadonly } from './reactive'

const toShallow: any = value => value
const getProto: any = value => Reflect.getPrototypeOf(value)

function createIterableMethod(method, isReadonly = false, isShallow = false) {
  return function iteratorMethod(this, ...args) {
    const target = this[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)

    // 判断是否为 [key, value]
    const isPair = method === 'entries' || (method === Symbol.iterator && targetIsMap)
    // 判断是否为 keys 操作
    const isKeyOnly = method === 'keys' && targetIsMap
    // 获取迭代器对象
    const innerIterator = target[method](...args)
    const wrap = isShallow
      ? toShallow
      : isReadonly ? toReadonly : toReactive

    // 对于 Map 的 keys 方法，不能使用 ITERATE_KEY 作为依赖收集的 key
    // 因为， keys 是针对 key 的访问，当更新的时候，是不需要触发依赖的（key 没有改变，只是值改变了）
    // 所以，依赖收集的时候，需要分开收集，不能都使用 ITERATE_KEY 作为依赖收集的 key
    // 针对 keys 操作，使用 MAP_KEY_ITERATE_KEY 作为依赖收集的 key
    // 在 trigger 的时候分别处理：
    // > ADD/DELETE 操作：触发 MAP_KEY_ITERATE_KEY 和 ITERATE_KEY 的依赖
    // > SET 操作：触发 ITERATE_KEY 的依赖
    !isReadonly && track(
      rawTarget,
      TrackOpTypes.ITERATE,
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY,
    )

    return {
      next() {
        // 调用 next() 方法，获取迭代器对象
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done,
            }
      },
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

function createReadonlyMethod(type) {
  return function (this) {
    return type === TriggerOpTypes.DELETE
      ? false
      : type === TriggerOpTypes.CLEAR
        ? undefined
        : this
  }
}

/**
 * 创建代理集合对象上相关属性（方法）的捕捉器，如 add、set、delete、clear、get、has、set、forEach 等方法
 * @param readonly 是否只读
 * @param shallow 是否浅代理
 */
function createInstrumentations(readonly, shallow) {
  const instrumentations = {
    get(this, key) {
      // 针对 readonly(reactive(Map)) 应该返回 readonly + reactive
      const target = this[ReactiveFlags.RAW] // 获取原始值
      const rawTarget = toRaw(target) // 进一步获取 target 的原始值
      const rawKey = toRaw(key) // 获取原始 key

      // 非只读代理
      if (!readonly) {
        if (hasChanged(key, rawKey)) {
          // 如果 key 和 rawKey 不一致，则进行依赖收集
          track(rawTarget, TrackOpTypes.GET, key)
        }
        track(rawTarget, TrackOpTypes.GET, rawKey)
      }

      // 获取原型上的 has 方法
      const { has } = getProto(rawTarget)
      // 根据不同代理类型（是否浅代理、是否只读），将值包装成不同响应式类型
      // > toShallow ：用于浅代理，直接返回原始值
      // > toReadonly ：用于只读代理
      // > toReactive ：用于普通响应式代理
      const wrap = shallow
        ? toShallow
        : readonly ? toReadonly : toReactive

      if (has.call(rawTarget, key)) {
        // 如果 key 存在与 rawTarget 中，则返回包装后的值
        return wrap(target.get(key))
      }
      else if (has.call(rawTarget, rawKey)) {
        // 如果 rawKey 存在与 rawTarget 中，则返回包装后的值
        return wrap(target.get(rawKey))
      }
      else if (target !== rawTarget) {
        // readonly(reactive(Map)) 确保嵌套了 reactive(Map) 可以自己收集依赖
        target.get(key)
      }
    },
    get size() {
      // 当修改集合对象时，使用 ITERATE_KEY 作为依赖收集的 key ，因为会修改集合对象的 size

      const target = this[ReactiveFlags.RAW]
      !readonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
      return Reflect.get(target, 'size', target)
    },
    has(this, key) {
      const target = this[ReactiveFlags.RAW]
      const rawTarget = toRaw(target)
      const rawKey = toRaw(key)

      if (!readonly) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, TrackOpTypes.HAS, key)
        }
        track(rawTarget, TrackOpTypes.HAS, rawKey)
      }

      return key === rawKey
        ? target.has(key)
        : target.has(rawKey) || target.has(key)
    },
    forEach(this, callback, thisArg) {
      // eslint-disable-next-line ts/no-this-alias
      const observed = this
      const target = observed[ReactiveFlags.RAW]
      const rawTarget = toRaw(target)
      const wrap = shallow
        ? toShallow
        : readonly ? toReadonly : toReactive

      !readonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)

      return target.forEach((value, key) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed)
      })
    },
  }

  extend(
    instrumentations,
    readonly
      ? {
          add: createReadonlyMethod(TriggerOpTypes.ADD),
          set: createReadonlyMethod(TriggerOpTypes.SET),
          delete: createReadonlyMethod(TriggerOpTypes.DELETE),
          clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
        }
      : {
          add(this, value) {
            if (!shallow && !isShallow(value) && !isReadonly(value)) {
              value = toRaw(value)
            }

            const target = toRaw(this)
            const proto = getProto(target)
            const hasKey = proto.has.call(target, value)

            if (!hasKey) {
              target.add(value)
              trigger(target, TriggerOpTypes.ADD, value)
            }
            return this
          },
          set(this, key, value) {
            if (!shallow && !isShallow(value) && !isReadonly(value)) {
              value = toRaw(this)
            }

            const target = toRaw(this)
            const { has, get } = getProto(target)

            let hadKey = has.call(target, key)
            if (!hadKey) {
              key = toRaw(key)
              hadKey = has.call(target, key)
            }

            const oldValue = get.call(target, key)
            target.set(key, value)
            if (!hadKey) {
              trigger(target, TriggerOpTypes.ADD, key, value)
            }
            else if (hasChanged(value, oldValue)) {
              trigger(track, TriggerOpTypes.SET, key, value, oldValue)
            }

            return this
          },
          delete(this, key) {
            const target = toRaw(this)
            const { has, get } = getProto(target)

            let hadKey = has.call(target, key)
            if (!hadKey) {
              key = toRaw(key)
              hadKey = has.call(target, key)
            }

            const oldValue = get ? get.call(target, key) : undefined
            const result = target.delete(key)
            if (hadKey) {
              trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
            }
            return result
          },
          clear(this) {
            const target = toRaw(this)
            const hadItems = target.size !== 0
            const result = target.clear()
            if (hadItems) {
              trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, undefined)
            }
            return result
          },
        },
  )

  const iteratorMethod = ['keys', 'values', 'entries', Symbol.iterator]
  iteratorMethod.forEach((method) => {
    instrumentations[method] = createIterableMethod(method, readonly, shallow)
  })

  return instrumentations
}

/**
 * 创建集合对象（Map、Set、WeakMap、WeakSet）【读取】操作的捕捉器
 * 用于处理代理集合对象的属性（方法）的访问
 * @param isReadonly 是否只读
 * @param shallow 是否浅代理
 */
function createInstrumentationsGetter(isReadonly = false, shallow = false) {
  // 创建代理集合对象上相关属性（方法）的捕捉器
  const instrumentations = createInstrumentations(isReadonly, shallow)

  return (target, key, receiver) => {
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 访问 ReactiveFlags.IS_REACTIVE 时，用于判断是否为响应式对象
      return !isReadonly
    }
    else if (key === ReactiveFlags.IS_READONLY) {
      // 访问 ReactiveFlags.IS_READONLY 时，用于判断是否为只读对象
      return isReadonly
    }
    else if (key === ReactiveFlags.RAW) {
      // 访问 ReactiveFlags.RAW 时，用于返回 target 原始对象
      return target
    }

    return Reflect.get(
      // 判断 instrumentations 是否存在 key，且 key 存在于 target 上，则返回 instrumentations （重写集合对象上的方法代理）
      // 否则，返回 target
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver,
    )
  }
}

// 深度
export const mutableCollectionHandlers = {
  get: createInstrumentationsGetter(false, false),
}
// 深度只读
export const readonlyCollectionHandlers = {
  get: createInstrumentationsGetter(true, false),
}
// 浅层响应
export const shallowReactiveCollectionHandlers = {
  get: createInstrumentationsGetter(false, true),
}
// 浅层只读
export const shallowReadonlyCollectionHandlers = {
  get: createInstrumentationsGetter(true, true),
}
