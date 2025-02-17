import { currentInstance, LifecycleHooks } from './component'

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)

// 创建生命周期钩子的工厂函数
function createHook(lifecycle) {
  // 返回一个闭包函数，支持默认当前实例
  return (
    hook,
    target = currentInstance,
  ) => injectHook(lifecycle, hook, target)
}

// 实际注入钩子的核心方法
function injectHook(
  type: LifecycleHooks,
  hook: () => void,
  target,
) {
  if (!target) {
    console.error('生命周期钩子只能在 setup() 函数内注册')
    return
  }

  // 获取或初始化该类型的钩子数组
  const hooks = target[type] || (target[type] = [])
  // 将回调推入队列（Vue 会逆序执行 composition API 钩子）
  hooks.push(hook)
}
