import { camelize, toHandlerKey } from '@mini-vue3/shared'

// 用于在组件实例中触发自定义事件
export function emit(instance, event: string, ...args) {
  const props = instance.vnode.props
  // 将事件名称转换为驼峰式命名，再将驼峰格式的事件名称转换为 on 开头的事件名称
  // Vue 提供两种事件命名风格：驼峰式命名和 kebab-case 命名
  const evenName = toHandlerKey(camelize(event))
  const handler = props[evenName]

  if (handler) {
    handler(...args)
  }
  else {
    console.error('事件不存在！')
  }
}
