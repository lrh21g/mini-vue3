import {
  extend,
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  makeMap,
} from '@mini-vue3/shared'
import {
  ReactiveFlags,
  TrackOpTypes,
  TriggerOpTypes,
} from './constants'
import {
  enableTracking,
  ITERATE_KEY,
  pauseTracking,
  track,
  trigger,
} from './effect'
import {
  isReadonly,
  isShallow,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  toRaw,
} from './reactive'
import { isRef } from './ref'

// 不需要 track 的属性
// 某些属性或对象可能不需要被代理或追踪，这些特殊属性通常用作内部标识，用于避免进行响应式代理
// 将不需要被代理的属性添加到 isNonTrackableKeys 中，可以在处理对象或数据时，快速检查某个属性是否属于不需要追踪的属性
const isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`)

// 获取 Symbol 对象中有效属性名的数组
const builtInSymbols = new Set(
  // Object.getOwnPropertyNames(Symbol) 返回一个包含 Symbol 所有可枚举的属性名的数组
  Object.getOwnPropertyNames(Symbol)
    // 在 ios 10.x 中，Object.getOwnPropertyNames(Symbol) 可以枚举 'arguments' 和 'caller'
    // 但是，在 Symbol 上访问会抛出 TypeError ，因为 Symbol 是一个严格模式函数
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(isSymbol),
)
// 重写原生 hasOwnProperty 方法，加入对响应式的支持
function hasOwnProperty(this: object, key: unknown) {
  // hasOwnProperty 可使用非字符串值调用
  // 判断 key 是否为 Symbol 类型，如果不是，则转换为字符串类型，确保 key 可以作为对象的属性名
  if (!isSymbol(key))
    key = String(key)

  // 获取原始对象
  const obj = toRaw(this)
  // 进行依赖收集（对对象属性进行 HAS 查询）
  track(obj, TrackOpTypes.HAS, key)
  // 调用原生的 hasOwnProperty 方法，检查 obj 是否拥有 key 属性
  return Object.prototype.hasOwnProperty.call(obj, key as string)
}

// 对 Array 的某些方法进行增强，以便在响应式系统中正确的处理依赖追踪和更新
function createInstrumentations() {
  const instrumentations = {}
  ;(['indexOf', 'includes', 'lastIndexOf']).forEach((key) => {
    // 在 Vue3 中，会对数组中的所有值进行 track ，用来绑定 effect
    // 在 mini-vue3 中，不需要进行 track
    // 因为在 includes 方法内部会遍历 this （代理数组），由于在 Vue3 中，将 this 通过 toRaw 转换为原始对象，不在具有响应式，在遍历的时候不会 track
    // 在 mini-vue3 中，为了减代码量，没有将 this 通过 toRaw 转换为原始对象，所以在调用 includes 方法时，直接遍历的是响应式对象，会自动触发 track

    const originMethod = Array.prototype[key] // 获取原型上的方法
    instrumentations[key] = function (this, ...args) {
      // 在 this （即 Proxy） 中查找是否存在对应方法
      let res = originMethod.apply(this, args)
      if (res === -1 || res === false) {
        // 如果 Proxy 中未查找到，则在原始对象中查找
        // this[ReactiveFlags.RAW] 表示获取到原始对象
        res = originMethod.apply(this[ReactiveFlags.RAW], args)
      }
      return res
    }
  })
  ;(['push', 'pop', 'shift', 'unshift', 'splice']).forEach((key) => {
    const originMethod = Array.prototype[key] // 获取原型上的方法
    instrumentations[key] = function (this, ...args) {
      // 在调用数组修改值的方法过程中，需要暂停依赖收集，保证数组添加的正确性（避免多次循环触发依赖）

      // 调用方法的过程中，禁止收集依赖
      pauseTracking()
      const res = originMethod.apply(this, args)
      // 方法执行完成后，允许收集依赖
      enableTracking()
      return res
    }
  })
  return instrumentations
}

const arrayInstrumentations = createInstrumentations()

/**
 * 创建拦截【读取】操作的捕捉器
 * 返回一个 get 函数，用于处理代理对象（Proxy）上的属性访问
 * get 函数会在访问响应式对象的属性时触发，用于进行依赖收集
 * @param isReadonly 是否只读
 * @param isShallow 是否浅代理
 */
function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {
    if (key === ReactiveFlags.SKIP) {
      // 访问 ReactiveFlags.SKIP 时，获取 ReactiveFlags.SKIP 标识，用于跳过某些操作
      return target[ReactiveFlags.SKIP]
    }

    if (key === ReactiveFlags.IS_REACTIVE) {
      // 访问 ReactiveFlags.IS_REACTIVE 时，用于判断是否为响应式对象
      return !isReadonly
    }
    else if (key === ReactiveFlags.IS_READONLY) {
      // 访问 ReactiveFlags.IS_READONLY 时，用于判断是否为只读对象
      return isReadonly
    }
    else if (key === ReactiveFlags.IS_SHALLOW) {
      // 访问 ReactiveFlags.IS_SHALLOW 时，用于判断是否为浅代理对象
      return isShallow
    }
    else if (key === ReactiveFlags.RAW) {
      // 如果当前 receiver 和 target 所在的响应式代理匹配（根据不同类型查找对应代理映射，shallowReadonlyMap、readonlyMap 等保存了代理对象的映射），则返回 target 原始对象
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

    const targetIsArray = isArray(target)
    if (!isReadonly) {
      // 如果 target 是数组时，且 key 是 arrayInstrumentations 中重写的方法（如 push、pop 等），则调用自定义的数组方法
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      // 如果 key 是 hasOwnProperty，则返回自定义的 hasOwnProperty 方法
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    const res = Reflect.get(
      target,
      key,
      // 如果 target 是一个 ref 代理，则使用原 ref，否则使用 receiver （即当前代理对象）
      isRef(target) ? target : receiver,
    )

    // 如果 key 是 Symbol 且为内置符号（如 symbol.iterator 等），或者其他不需要代理的属性（如 __proto__ 等），则直接返回。
    // 为避免发生意外的错误，以及性能的考虑，不应该和副作用函数建立关系，因此需要过滤掉
    // 当使用 for...of 循环时，会读取数组的 Symbol.iterator 属性
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // 如果是非只读代理，则调用 track 进行依赖收集，确保后续属性变化时触发更新
    if (!isReadonly) {
      track(target, 'get', key)
    }

    // 如果是浅层代理（Proxy 只代理一层），则直接返回，不进行深层代理
    if (isShallow) {
      return res
    }

    // 如果是 ref ，当访问的 key 是数组的索引，则返回 ref 本身，否则进行解包返回 .value 属性
    if (isRef(res)) {
      // ref 解包：跳过 Array + integer key ref 解包
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // 如果属性为对象，根据是否只读返回对应的深度代理对象
    if (isObject(res)) {
      // 将返回值（res）转化为响应式代理对象。使用 isObject 进行检查，避免无效值警告
      // 同时， readonly 和 reactive 进行懒访问（在取值时进行代理），避免循环依赖
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

/**
 * 创建拦截【设置】操作的捕捉器
 * 返回一个 set 函数，用于处理代理对象（Proxy）上的属性设置
 * set 函数会在修改响应式对象的属性时触发，用于触发更新和执行副作用函数（effect）
 * @param _isShallow 是否浅代理
 */
function createSetter(_isShallow = false) {
  return function set(target, key, value, receiver) {
    // 获取代理对象 target 上 key 对应的当前值
    let oldValue = target[key]

    // 非浅层代理
    if (!_isShallow) {
      const isOldValueReadonly = isReadonly(oldValue)

      // 如果新值 value 不是浅代理且不是只读的，则将 oldValue 和 value 转化为原始对象，避免对代理对象进行嵌套处理
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue)
        value = toRaw(value)
      }

      // 如果 target 不是数组，且旧值 oldValue 是 ref ，且新值 value 不是 ref
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        // 如果旧值 oldValue 是只读的，则返回为 false，表示不可修改只读的 ref
        // 否则，将 oldValue.value 设置为 value，并返回 true
        if (isOldValueReadonly) {
          return false
        }
        else {
          oldValue.value = value
          return true
        }
      }
    }

    // 判断 target 是否存在属性 key
    // 如果 target 是数组，且 key 是整数索引，则检查 key 是否小于数组长度
    // 否则，通过 hasOwn 判断 key 是否是 target 上的属性
    const hadKey = isArray(target) && isIntegerKey(key)
      ? Number(key) < target.length
      : hasOwn(target, key)
    const res = Reflect.set(
      target,
      key,
      value,
      isRef(target) ? target : receiver,
    )

    // 当前代理对象（receiver）转化为原始对象后，和当前 target 相等，说明当前访问的不是原型链上的属性，则需要触发更新
    // eg :
    // const obj = {}
    // const proto = { a: 1 }
    // const parent = reactive(proto)
    // const child = reactive(obj)
    // Object.setPrototypeOf(child, parent) // child.__proto__ = parent
    // effect(() => {
    //   console.log(child.a) // child 对象上没有属性 a ，则会去原型链上查找属性 a
    // })
    // 问题：如果 child 原对象上没有该属性 a，则会在原型链上查找 a 执行 trigger 。此时会触发两次 trigger ：第一次触发在 child 响应式对象上，第二次触发在 parent 对象上。由于两个对象都是响应式，所以要出发两次。
    // 处理方法： 使用 target === toRaw(receiver) ，仅处理自身的属性
    if (target === toRaw(receiver)) {
      // 如果 target 中没有该属性，则触发 ADD 操作
      // 否则，表示 target 中已有该属性，并且当新值和旧值不同时，触发 SET 操作
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      }
      else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }

    return res
  }
}

// 创建 Object.getOwnPropertyNames 方法和 Object.getOwnPropertySymbols 方法的捕捉器
// 用来代理对象对属性键的枚举操作，并进行依赖收集。通常会在使用 for...in、Object.keys() 或 Object.getOwnPropertyNames() 时被触发。
// > Object.getOwnPropertyNames() : 返回一个数组，其包含给定对象中所有自有属性（包括不可枚举属性，但不包括使用 symbol 值作为名称的属性）
// > Object.getOwnPropertySymbols() : 返回一个包含给定对象所有自有 Symbol 属性的数组
// ownKeys() 捕捉器没有参数 key ，是因为对象和数组的 for..in 操作，没有针对某一个 key 进行操作，而是针对整个对象
function ownKeys(target) {
  // 如果当前操作的对象是数组时，使用 'length' 作为依赖的 key ，因为操作数组都会修改数组的长度
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}

// 创建 in 操作符的捕捉器
// in 操作符：如果指定的属性在指定的对象或其原型链中，则 in 运算符返回 true。
function has(target, key) {
  const result = Reflect.has(target, key)

  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    // 如果 key 不是 Symbol 类型，或者不是 Symbol 对象中有效属性名，则调用 track 进行依赖收集
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

// 创建 delete 操作符的捕捉器
// 用于在属性删除时，触发依赖更新，并确保响应式系统能够正确处理副作用
// > delete 操作符：用于删除对象的一个属性；如果该属性的值是一个对象，并且没有更多对该对象的引用，该属性所持有的对象最终会自动释放。
function deleteProperty(target, key) {
  const hadKey = hasOwn(target, key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)

  // 如果删除属性操作成功，并且 target 上原本存在该属性，则执行 trigger 触发依赖更新与副作用
  if (result && hadKey) {
    // undefined 为删除操作后的新值，属性被删除时它的值是 undefined。
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

const readOnlyObj = {
  set: (target, key, value) => {
    console.warn(`设置 ${key} 为 ${value} 失败 : target 是 readonly 。`, target)

    // 设置属性值操作的捕捉器
    // set() 方法应当返回一个布尔值。
    // > 返回 true 代表属性设置成功。
    // > 在严格模式下，如果 set() 方法返回 false，那么会抛出一个 TypeError 异常。
    // see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set
    return true
  },
  deleteProperty: (target, key) => {
    console.warn(`删除 ${key} 失败 : target 是 readonly 。`, target)

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
  ownKeys,
  has,
  deleteProperty,
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
