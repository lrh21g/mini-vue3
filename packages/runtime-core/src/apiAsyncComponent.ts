import type { ComponentInternalInstance } from './component'
import { ref, shallowRef } from '@mini-vue3/reactivity'
import { isFunction } from '@mini-vue3/shared'
import { defineComponent } from './apiDefineComponent'
import { onUnmounted } from './apiLifecycle'
import { currentInstance } from './component'
import { createVNode, Text } from './vnode'

// 异步组件加载器类型（返回 Promise 的工厂函数）
export type AsyncComponentLoader<T = any> = () => Promise<T>

// 异步组件配置选项
export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T> // 加载函数
  timeout?: number // 超时时间（毫秒）
  delay?: number // 延迟显示加载状态的时间
  loadingComponent?: object // 加载中组件
  errorComponent?: object // 错误提示组件
  onError?: (
    err: Error,
    retry,
    fail,
    retries: number
  ) => void // 错误处理回调
}

// 判断是否为异步包装组件
export const isAsyncWrapper = (i): boolean => !!i.__asyncLoader

export function defineAsyncComponent(source: AsyncComponentOptions | AsyncComponentLoader) {
  // 标准化参数：函数形式转对象形式
  if (isFunction(source)) {
    source = { loader: source }
  }

  // 解构配置参数（带默认值）
  const {
    loader,
    errorComponent,
    loadingComponent,
    delay = 200, // 默认延迟 200ms 显示加载状态
    timeout,
    onError,
  } = source

  let retries = 0 // 重试计数器
  let resolvedComp // 缓存已解析的组件

  const load = () => {
    return loader()
      // 加载失败处理
      .catch((err) => {
        // 自定义错误处理
        if (onError) {
          return new Promise((resolve, reject) => {
            // 重试
            const retry = () => {
              resolve(load()) // 递归重试
              retries++
            }
            // 失败
            const fail = () => reject(err)

            // 将 retry、file、retires传入 onError 回调函数交给用户处理
            onError(err, retry, fail, retries)
          })
        }
        else {
          throw err // 无处理直接抛出
        }
      })
      // 加载成功缓存
      .then((comp) => {
        resolvedComp = comp
        return comp
      })
  }

  // 返回包装组件
  return defineComponent({
    name: 'AsyncComponentWrapper',
    __asyncLoader: load, // 内部标识属性
    // 已解析组件访问器
    get __asyncResolved() {
      return resolvedComp
    },
    setup() {
      // 当前组件实例
      const instance = currentInstance!

      // 已缓存直接返回
      if (resolvedComp) {
        return createInnerComp(resolvedComp, instance)
      }

      const loaded = ref(false) // 加载完成标志
      const isTimeout = ref(false) // 超时标志
      const error = shallowRef(null) // 错误信息
      const isLoading = ref(false) // 加载中状态

      let loadingTimer: any = null // 延迟计时器
      // 延迟显示加载状态
      if (delay) {
        loadingTimer = setTimeout(() => {
          isLoading.value = true
        }, delay)
      }
      else {
        isLoading.value = true
      }

      // 执行加载
      load().then((_comp) => {
        loaded.value = true
      }).catch(err => error.value = err).finally(() => {
        isLoading.value = false
        // 清除延迟计时器
        clearTimeout(loadingTimer)
      })

      let timer: any = null
      // 超时处理
      if (timeout) {
        timer = setTimeout(() => {
          const err = new Error(`Async component timed out after ${timeout}ms.`)
          error.value = err
          isTimeout.value = true
        }, timeout)
      }

      // 组件卸载清理
      onUnmounted(() => {
        clearTimeout(timer)
      })

      // 默认空占位符
      const defaultPlaceholder = createVNode(Text, {}, '')

      return () => {
        // 加载成功
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance)
        }
        // 显示错误组件
        else if ((errorComponent && error.value)) {
          return createVNode(errorComponent, { error: error.value })
        }
        // 显示加载状态
        else if ((loadingComponent && isLoading.value)) {
          return createVNode(loadingComponent, {})
        }
        // 默认空内容
        else {
          return defaultPlaceholder
        }
      }
    },
  })
}

// 创建内部组件 VNode（透传props和插槽）
export function createInnerComp(
  comp,
  parent: ComponentInternalInstance,
) {
  const { props, children } = parent.vnode as any
  const vnode = createVNode(comp, props, children)
  return vnode
}
