/* eslint-disable ts/no-use-before-define */
import { ReactiveEffect } from '@mini-vue3/reactivity'
import { isFunction, isObject } from '@mini-vue3/shared'

export function watch(source, cb, options) {
  let getter // 保存观察的目标对象的访问函数，供 ReactiveEffect 使用
  let cleanup // 清理副作用的函数

  // 如果是函数，则指定了访问的属性
  if (isFunction(source)) {
    getter = source
  }
  // 如果是对象,说明当前的的对象的所有属性都需要监听，直接递归
  else {
    getter = () => traverse(source)
  }

  // 注册清理函数的方法
  function onInvalidDate(fn) {
    cleanup = fn
  }

  let newValue, oldValue

  const job = () => {
    // 执行 effect，获取最新值
    newValue = effect.run()

    // 执行清理操作
    if (cleanup) {
      cleanup()
    }

    // 触发回调（支持清理函数注册）
    cb(oldValue, newValue, onInvalidDate)

    // 更新旧值
    oldValue = newValue
  }

  // 调度器
  const scheduler = () => {
    if (options && options.flush === 'post') {
      console.warn('post 组件更新之后执行')

      const p = Promise.resolve()
      p.then(job)
    }
    else if (options && options.flush === 'pre') {
      console.warn('post 组件更新之前执行')
    }
    else {
      job() // 同步执行
    }
  }

  // 创建响应式 effect
  const effect = new ReactiveEffect(getter, scheduler)

  // 立即执行
  if (options && options.immediate) {
    job()
  }
  // 没运行job之前，需要执行一次用于收集依赖，并把初始值（直接执行的 effect.run() 获取初始值）设置为老值
  else {
    oldValue = effect.run()
  }
}

// 深度遍历函数
function traverse(value, seen = new Set()) {
  if (!isObject(value) || seen.has(value))
    return

  seen.add(value)

  for (const key in value) {
    // 递归访问所有属性
    traverse(value[key], seen)
  }
  return value
}
