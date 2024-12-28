import { extend } from '@mini-vue3/shared'

// 存储依赖关系
// WeakMap ： 键值对的集合，其中的键必须是对象或 Symbol ，且值可以是任意的 JavaScript 类型，并且不会创建对它的键的强引用。
// 一个对象作为 WeakMap 的键存在，不会阻止该对象被垃圾回收。一旦一个对象作为键被回收，那么在 WeakMap 中相应的值便成为了进行垃圾回收的候选对象，只要它们没有其他的引用存在。
// see : https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const targetMap = new WeakMap()

let activeEffect

class ReactiveEffect {
  private _fn: any
  public scheduler?: () => void

  // 用于记录 effect 对应的依赖属性
  deps = []
  // 是否是响应式的 effect
  active = true
  onStop?: () => void

  constructor(fn, scheduler?: () => void) {
    this._fn = fn
    this.scheduler = scheduler
  }

  run() {
    if (!this.active) {
      return this._fn()
    }

    // eslint-disable-next-line ts/no-this-alias
    activeEffect = this
    const r = this._fn()
    return r
  }

  // 停止当前的 effect ： 取消 effect 与 dep 的关联
  // 将 dep 上存储的 effect 删除即可
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

// 清楚 effect
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

// 收集依赖
export function track(target, type, key) {
  // console.log(`触发 track -> target: ${target} type:${type} key:${key}`)

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
    dep = new Set()
    depsMap.set(key, dep)
  }

  trackEffects(dep)
}

// 收集 effect
export function trackEffects(dep) {
  if (dep.has(activeEffect))
    return

  if (!activeEffect)
    return

  // 将当前的 activeEffect 添加到 dep 中，主要用于响应式对象变化时执行对应的 effect
  dep.add(activeEffect)
  // 将当前依赖添加到 activeEffect 的 deps 数组中，主要用于删除当前 effect 对应的 dep
  activeEffect.deps.push(dep)
}

// 触发更新
export function trigger(target, type, key) {
  // console.log(`触发 trigger -> target: ${target} type:${type} key:${key}`)

  const depsMap = targetMap.get(target)
  const dep = depsMap.get(key)

  for (const effect of dep) {
    if (effect.scheduler) {
      effect.scheduler()
    }
    else {
      effect.run()
    }
  }
}
