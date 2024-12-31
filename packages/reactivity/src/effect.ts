import { extend } from '@mini-vue3/shared'
import { createDep } from './dep'

// 存储依赖关系
// WeakMap ： 键值对的集合，其中的键必须是对象或 Symbol ，且值可以是任意的 JavaScript 类型，并且不会创建对它的键的强引用。
// 一个对象作为 WeakMap 的键存在，不会阻止该对象被垃圾回收。一旦一个对象作为键被回收，那么在 WeakMap 中相应的值便成为了进行垃圾回收的候选对象，只要它们没有其他的引用存在。
// see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const targetMap = new WeakMap()

let activeEffect
let shouldTrack = true

class ReactiveEffect {
  // 用于维护父 effect
  parent = null
  // 用于记录 effect 依赖的属性
  deps = []
  // 是否是响应式的 effect
  active = true
  onStop?: () => void

  constructor(public fn, public scheduler?: () => void) {}

  run() {
    if (!this.active) {
      return this.fn()
    }

    let parent: ReactiveEffect | null = activeEffect
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

      return this.fn()
    }
    finally {
      activeEffect = this.parent
      this.parent = null
    }
  }

  // 停止当前的 effect ： 取消 effect 与 dep 的关联，将 dep 上存储的 effect 删除即可
  stop() {
    if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

// 清楚 effect 依赖的响应式对象
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

// 创建 effect
export function effect(fn, options: any = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler)
  extend(_effect, options)

  _effect.run()

  const runner: any = _effect.run.bind(_effect)
  runner.effect = _effect

  return runner
}

export function stop(runner) {
  runner.effect.stop()
}

export const isTracking = () => shouldTrack && activeEffect !== undefined

// 暂停跟踪 （依赖收集）
export function pauseTracking() {
  shouldTrack = false
}

// 开启跟踪（依赖收集）
export function enableTracking() {
  shouldTrack = true
}

/**
 * effect 依赖收集
 * @param target
 * @param type
 * @param key
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
 * @param key 当前的触发的key
 */
export function trigger(target, type, key) {
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

  if (key !== void 0) {
    // 获取当前 key 的依赖，添加到 effects 中
    add(depsMap.get(key))
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
