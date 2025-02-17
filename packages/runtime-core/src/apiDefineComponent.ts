import { isFunction } from '@mini-vue3/shared'

// 统一组件定义格式
export function defineComponent(options: unknown) {
  return isFunction(options)
    ? {
        setup: options, // 将函数作为 setup 方法
        name: options.name, // 提取函数的name属性作为组件名
      }
    : options // 否则直接返回 options
}
