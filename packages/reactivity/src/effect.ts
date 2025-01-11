import { extend, isArray, isIntegerKey, isMap } from '@mini-vue3/shared'
import { TriggerOpTypes } from './constants'
import { createDep } from './dep'

// ITERATE_KEY 表示 for...in 操作类型所触发的依赖收集的 key
// for...in 操作是针对对象的访问，没有针对对象的属性，所以没有 key 。直接自定义一个 key，用于专门处理
// eslint-disable-next-line symbol-description
export const ITERATE_KEY = Symbol()

// 针对 map 的方法 .keys 的依赖收集 key
// eslint-disable-next-line symbol-description
export const MAP_KEY_ITERATE_KEY = Symbol()

// 存储依赖关系
// WeakMap ： 键值对的集合，其中的键必须是对象或 Symbol ，且值可以是任意的 JavaScript 类型，并且不会创建对它的键的强引用。
// 一个对象作为 WeakMap 的键存在，不会阻止该对象被垃圾回收。一旦一个对象作为键被回收，那么在 WeakMap 中相应的值便成为了进行垃圾回收的候选对象，只要它们没有其他的引用存在。
// see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const targetMap = new WeakMap()

let activeEffect
let shouldTrack = true // 是否应该收集依赖

export class ReactiveEffect {
  // 用于维护父 effect
  parent = null
  // 用于记录 effect 依赖的属性
  deps = []
  // 表示当前副作用是否处于活动状态。如果停止副作用（调用 effect.stop()），active 为 false，则不会再执行相关的副作用逻辑
  active = true
  // 停止 effect 的回调
  onStop?: () => void

  constructor(
    // 副作用的执行函数。当依赖的属性变化时，fn 会被调用，触发副作用逻辑的执行
    public fn,
    // 调度函数。在副作用需要执行时，会先通过调度函数来控制执行的时机。
    // 1. 通过 effect 的第二个参数，给定一个 scheduler 函数
    // 2. effect 第一次执行时，会执行  fn
    // 3. 当响应式对象被 set 时（即依赖属性被更新），如果 scheduler 存在，则不会执行 fn ，而是执行 scheduler
    // 4. 当再次执行 runner 时，才会再次执行 fn
    public scheduler?: () => void,
  ) {}

  run() {
    // 如果副作用被停止，则直接执行 fn ，并返回结果
    if (!this.active) {
      return this.fn()
    }

    let parent: ReactiveEffect | null = activeEffect
    // 通过循环判断当前副作用是否在执行中，防止副作用递归执行（即副作用互相依赖）。如果当前副作用已经在父级副作用的调用链中，直接返回，不执行。
    while (parent) {
      if (parent === this)
        return
      parent = parent.parent
    }

    try {
      this.parent = activeEffect
      // eslint-disable-next-line ts/no-this-alias
      activeEffect = this

      // 在执行前清除当前 effect 依赖的 deps ，防止出现以下情况：
      // const flag = reactive({ value: true })
      // const data = reactive({ msg: 'flag value is true' })
      // effect(() => {
      //   if (flag.value) {
      //     console.log(data.msg)
      //   } else {
      //     console.log('flag value is false')
      //   }
      // })
      // flag.value = false
      // 在上述示例中，flag.value 设置为 false 后，此时修改 data.msg 的值也会触发 effect
      // 为避免一些不需要的依赖触发，在执行 effect 之前需要清除当前 effect 中依赖的 deps 数组
      cleanupEffect(this)

      // 执行副作用的执行函数
      return this.fn()
    }
    finally {
      // 执行完成副作用执行函数后，恢复之前的 activeEffect，并将当前副作用的 parent 设置为 null
      activeEffect = this.parent
      this.parent = null
    }
  }

  // 停止当前的 effect ： 取消 effect 与 dep 的关联，将 dep 上存储的 effect 删除即可
  stop() {
    if (this.active) {
      cleanupEffect(this) // 清除当前副作用的依赖
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

// 清除 effect 依赖的响应式对象
function cleanupEffect(effect) {
  // 不能直接使用 effect.deps = []
  // 该操作只会清除当前 effect 对应的 deps 数组，而不会取消收集依赖（track）时 dep 关联的 effect

  // 获取 effect 依赖的响应式对象，并清除响应式对象上存储的 effect
  const { deps } = effect
  // 删除依赖关系，必须分别循环 deps 进行删除（因为 Set 是引用类型）
  for (const dep of deps) {
    dep.delete(effect)
  }

  deps.length = 0
}

/**
 * 创建 effect 副作用：引用响应式数据，它会在数据变化时自动执行。
 * @param fn 副作用执行函数
 * @param options 可选的配置对象
 */
export function effect(fn, options: any = {}) {
  // 创建一个新的 ReactiveEffect 实例，负责执行副作用函数 fn，并处理依赖收集和调度逻辑。
  const _effect = new ReactiveEffect(fn, options.scheduler)
  // 扩展 ReactiveEffect 实例的配置，将 options 对象的所有属性拷贝到 _effect 实例上
  extend(_effect, options)

  // 非懒加载，则立即执行
  if (!options.lazy) {
    // 触发副作用执行函数 fn 的执行，同时收集 fn 中使用的响应式数据依赖
    // 副作用执行函数 fn 在首次执行时会访问响应式数据，这时会收集这些数据与副作用的关系。当数据变化时，这些副作用会被重新触发
    _effect.run()
  }

  // 使用 bind 方法，将 run 方法的 this 绑定到 _effect 上，确保调用 runner 时，this 可以指向正确的 ReactiveEffect 实例
  // runner 是副作用的执行器，它本身并不立即执行副作用，而是通过 runner() 来触发副作用的执行
  const runner: any = _effect.run.bind(_effect)
  // 在 runner 函数上挂载 effect 属性，指向 ReactiveEffect 实例 _effect
  // 通过 runner.effect 可以访问到原始的副作用实例，如果需要停止副作用或者访问副作用的其他信息时，可以通过 runner.effect 来获取。
  runner.effect = _effect

  // effect 函数返回 runner
  // 在调用 effect 返回的 runner 函数时，相当于执行副作用函数（即调用 run()），并触发依赖收集和更新。
  return runner
}

export function stop(runner) {
  runner.effect.stop()
}

// 用户控制是否进行依赖收集
// 如果有副作用正在执行（即正在响应式数据上触发 get 操作），activeEffect 就会指向当前的副作用实例，否则它是 undefined
export const isTracking = () => shouldTrack && activeEffect !== undefined

// 暂停依赖收集，停止追踪副作用与响应式数据之间的依赖关系
// 对于一些需要在特定时机阻止依赖收集的情况非常有用，比如在批量更新或修改数据时，不希望每次数据读取都触发副作用的重新计算
export function pauseTracking() {
  shouldTrack = false
}

// 开启依赖收集，重新开始对响应式数据的依赖追踪
export function enableTracking() {
  shouldTrack = true
}

/**
 * effect 依赖收集
 * @param target
 * @param type 收集的类型
 * @param key 当前收集的key
 */
export function track(target, type, key) {
  // activeEffect（当前的effect）为空时不收集
  // eg :
  // const state = reactive({ num: 1 })
  // state.num // 此时，访问 num 时， activeEffect 为 undefined ， isTracking() 为 false
  // effect(() => { state.num }) // 此时，在 effect 函数中访问 num ， activeEffect 有值， isTracking() 为 true
  if (!isTracking())
    return

  // 获取当前 target 对象的依赖集
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    // 使用 Map 存储 target 的依赖关系。使用 Map 将当前 target 的属性与依赖一一对应
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  let dep = depsMap.get(key)
  if (!dep) {
    // 使用 Set 进行去重

    // 一个 effect 函数中可能出现多个相同的属性
    // eg: effect(() => { sum = state.num + state.num })

    // 存在一个响应式对象中的属性，在多个 effect 函数中引用。此时， Set 不会去重，因为是两个不同的引用地址
    // eg:
    //    effect(() => { state.num })
    //    effect(() => { state.num })
    //    相当于如下示例：
    //    let set = new Set()
    //    let a = () => { console.log('xxx') }
    //    let b = () => { console.log('xxx') }
    //    set.add(a)
    //    set.add(b)
    //    ==> set = { () => { console.log('xx') }, () => { console.log('xx') } }
    dep = createDep()
    depsMap.set(key, dep)
  }

  trackEffects(dep)
}

// 收集 effect
export function trackEffects(dep) {
  if (!dep.has(activeEffect)) {
    // 将 activeEffect 添加到 dep 中，主要用于响应式对象变化时执行对应的 effect
    dep.add(activeEffect)
    // 将 dep 添加到 activeEffect(ReactiveEffect) 的 deps 数组中，主要用于删除 effect 对应的 dep
    activeEffect.deps.push(dep)
  }
}

/**
 * 触发 effect 更新
 * @param target
 * @param type 触发的类型
 * @param key 当前触发的key
 */
export function trigger(target, type, key?, newValue?, _oldValue?) {
  const depsMap = targetMap.get(target)

  // 如果当前的 target 没有依赖就直接返回
  if (!depsMap)
    return

  // 使用 Set 可以对 effect 去重
  // eg :
  // const state = reactive({ a: 1, b: 2 })
  // effect(() => { state.a + state.b })
  // 在该 effect 中， target 为 state， key 为 a 和 b
  // 收集了两个依赖 a => () => { state.a + state.b } 和 b => () => { state.a + state.b }
  // 两个属性的依赖 effect 是同一个，所以需要去重
  const effects = new Set()
  // 添加需要执行的 effect
  const add = (effectsToAdd) => {
    if (effectsToAdd) {
      effectsToAdd.forEach((effect) => {
        effects.add(effect)
      })
    }
  }

  const targetIsArray = isArray(target)
  const isArrayIndex = targetIsArray && isIntegerKey(key)
  if (targetIsArray && key === 'length') {
    // 当前 key 是操作数组长度是时，需要将当前 target 数组所有和长度相关的依赖添加到 effect = new Set 集合中执行

    const newLength = Number(newValue)
    // depsMap 为数组中每个索引或者数组的属性所对应的 effect 依赖的映射
    // depsMap 的 key 是 target 数组的索引或者属性 length
    // 遍历 depsMap 查找出 key === 'length' 或者 key >= newLength 有关的 dep 添加到 effect = new Set 中
    // > key === 'length' : 和当前数组长度有关的 dep
    // > key > newLength : newLength 为修改数组长的度。如果 key >= newLength，需要将 dep 添加到 effect = new Set 中
    // eg:
    // const state = reactive({ str: 'abc', arr: [1, 2, 3, 4] })
    // effect(() => {
    //   // 此处，state.arr 内部会直接访问 .length 属性，在收集依赖时，会以 ‘length’ 为 key 存入 depsMap
    //   state.arr
    //   state.arr.length
    // })
    // // 修改之后为 [1, 2, 3]， state.arr[3] = undefined ，索引 3 之后的依赖（即 key >= newLength）需要将 dep 更新到 effect = new Set 中
    // state.arr.length = 3
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newLength) {
        add(dep)
      }
    })
  }
  else {
    // void 0 表示 undefined 。因为 void 0 为 6 个字节， undefined 为 9 个字节
    if (key !== void 0 || depsMap.has(void 0)) {
      // 获取当前 key 的依赖，添加到 effects 中
      add(depsMap.get(key))
    }

    switch (type) {
      case TriggerOpTypes.ADD:
        if (!targetIsArray) {
          // 对象触发的特殊情况
          // const data = reactive({ key1: 'value1', key2: 'value2', key3: 'value3' })
          // effect(() => {
          //   for (const key in data) { console.log(key) }
          // })
          // data.key4 = 'value4' // 当添加属性时，直接将 key 为 ITERATE_KEY 的依赖添加到 effects 中
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        else if (isArrayIndex) {
          // 数组触发的特殊情况：修改数组中的某一个索引，即数组新增索引直接查找 'length' 的依赖添加到 effects 中
          // const data = reactive({ arr: [1, 2, 3] })
          // effect(() => {
          //   data.arr // 此处，data.arr 内部会直接访问 .length 属性
          // })
          // data.arr[5] = 5 // 此时，修改的索引大于 arr 的最大索引，则需要重新执行 length 的依赖，以此达到数组的响应式
          add(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        // 删除对象的特殊情况
        // > Map / Set 进行 forEach / for..in 时，进行依赖跟踪，需要触发
        // > object 进行 for..in 时，进行依赖跟踪，需要触发
        if (!targetIsArray) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          add(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  // createDep 与 cleanupEffect 配合使用，直接重新创建一个引用，避免循环执行
  triggerEffects(createDep(effects))
}

export function triggerEffects(dep) {
  dep.forEach((effect: any) => {
    // effect !== activeEffect 用于处理在 effect 中修改响应式变量导致的无限循环
    if (activeEffect !== effect) {
      effect.scheduler ? effect.scheduler() : effect.run()
    }
  })
}
