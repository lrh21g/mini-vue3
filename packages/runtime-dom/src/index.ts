import { createHydrationRenderer, createRenderer } from '@mini-vue3/runtime-core'
import { extend, isString } from '@mini-vue3/shared'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'

// 存储渲染器实例，负责将虚拟 DOM 渲染为实际的 DOM
let renderer
// 渲染器的配置项
// > nodeOps 通常是一些关于 DOM 操作的函数，如创建元素、设置属性、添加事件等。
// > patchProp 则是 Vue 用来处理 DOM 属性更新的函数。
const rendererOptions = extend(nodeOps, { patchProp }) as any

// 确保渲染器 (renderer) 被创建并返回。
// 如果 renderer 已经存在，直接返回现有的渲染器实例；如果 renderer 不存在，则会调用 createRenderer 创建一个新的渲染器实例。
function ensureRenderer() {
  return (
    renderer
    || (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}

let enabledHydration = false
// 确保使用支持 SSR 水合（Hydration）的渲染器
export function ensureHydrationRenderer() {
  renderer = enabledHydration ? renderer : createHydrationRenderer(rendererOptions)
  enabledHydration = true
  return renderer
}

// 调用 Vue 渲染器的 render 方法，将组件渲染到指定的容器中
export function render(...args) {
  ensureRenderer().render(...args)
}

// 调用 Vue Hydration 渲染器的 hydrate 方法，将服务器端渲染（SSR）生成的 HTML 与 Vue 组件绑定
export function hydrate(...args) {
  ensureHydrationRenderer().hydrate(...args)
}

export function createApp(rootComponent, rootProps = null) {
  // 调用 ensureRenderer()，确保 Vue 渲染器存在
  const { createApp } = ensureRenderer()
  const app = createApp(rootComponent, rootProps)
  const { mount } = app
  // 重写 mount 方法，确保在应用挂载之前，容器内容是干净的
  app.mount = function (container) {
    // 判断 container 是否是字符串
    // 如果是，则使用 document.querySelector(container) 获取真实 DOM 节点
    if (isString(container)) {
      container = document.querySelector(container)
    }
    // 防止旧内容影响 Vue 组件渲染
    container.innerHTML = ''
    mount(container, false)
  }
  return app
}

// 创建一个支持服务器端渲染（SSR）的 Vue 应用，并在客户端执行 Hydration（水合）过程
export function createSSRApp(rootComponent, rootProps = null) {
  // 确保 Vue 使用 Hydration 渲染器（即支持 SSR Hydration 的 Vue 渲染器）
  const { createApp } = ensureHydrationRenderer()
  // 通过 SSR Hydration 渲染器的 createApp 创建 Vue 应用实例
  const app = createApp(rootComponent, rootProps)
  const { mount } = app
  app.mount = function (container) {
    if (isString(container)) {
      container = rendererOptions.querySelector(container)
    }
    // 传入 true 作为第二个参数，表示启用 启用 SSR Hydration
    // Vue 不会销毁容器内的已有 HTML，而是复用服务器渲染的 DOM 结构，并绑定事件
    mount(container, true)
  }
  return app
}

export { Transition } from './components/Transition'

export * from '@mini-vue3/runtime-core'
