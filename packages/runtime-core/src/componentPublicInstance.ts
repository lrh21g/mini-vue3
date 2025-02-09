import type { ComponentInternalInstance } from './component'
import { hasOwn } from '@mini-vue3/shared'

export interface ComponentRenderContext {
  [key: string]: any
  _: ComponentInternalInstance
}

// 定义了组件实例上内置属性的映射表
const publicPropertiesMap = {
  $el: i => i.vnode.el, // 组件根 DOM 元素
  $emit: i => i.emit, // 触发事件的方法
  $slots: i => i.slots, // 插槽对象
  $props: i => i.props, // 组件的 props
  $attrs: i => i.attrs, // 组件的 attrs （透传的非 prop 属性）
}

export const PublicInstanceProxyHandler = {
  // 拦截组件实例的属性访问操作
  get({ _: instance }: ComponentRenderContext, key) {
    const { setupState, props, data } = instance

    // 对于以 $ 开头的属性，检查 publicPropertiesMap 是否存在对应的处理函数，如果存在，则调用该函数并返回结果
    // 否则，按照优先级依次尝试访问 setupState、props、data 等属性，如果存在，则返回该属性的值，否则输出错误信息
    if (key.startsWith('$')) {
      return (publicPropertiesMap[key] && publicPropertiesMap[key](instance))
    }
    else {
      if (hasOwn(setupState, key)) {
        return setupState[key]
      }
      else if (hasOwn(data, key)) {
        return data[key]
      }
      else if (hasOwn(props, key)) {
        return props[key]
      }
      else {
        console.error('未查找到当前 key :', key)
      }
    }
  },
  // 拦截组件实例的属性赋值操作
  set({ _: instance }, key, value) {
    const { setupState, props, data } = instance
    if (hasOwn(setupState, key)) {
      setupState[key] = value
    }
    else if (hasOwn(data, key)) {
      data[key] = value
    }
    else if (hasOwn(props, key)) {
      // 对于 props，输出警告，因为它是只读的，不允许直接修改
      console.warn('Props are readonly')
      return false
    }
    else {
      console.error('未查找到当前 key :', key)
    }
    return true
  },
}
