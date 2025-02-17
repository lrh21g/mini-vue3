import { createComponentInstance, setupComponent } from './component'
import { renderComponentRoot } from './componentRenderUtils'
import { isVNode, normalizeVNode } from './vnode'

export { defineAsyncComponent } from './apiAsyncComponent'
export { defineComponent } from './apiDefineComponent'
export * from './apiLifecycle'
export { watch } from './apiWatch'

export {
  Component,
  ComponentInternalInstance,
  Data,
  registerRuntimeCompiler,
  RuntimeCompilerOptions,
  SetupContext,
} from './component'
export { TransitionHooks, TransitionProps } from './components/BaseTransition'
export { KeepAlive } from './components/KeepAlive'
export { Teleport } from './components/Teleport'

export { h } from './h'

export {
  createHydrationRenderer,
  createRenderer,
  isKeepAlive,
  RendererOptions,
} from './renderer'

export {
  Comment,
  createElementVNode,
  createVNode,
  Fragment,
  Text,
  VNode,
} from './vnode'

export { toDisplayString } from '@mini-vue3/shared'

const _ssrUtils = {
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
  isVNode,
  normalizeVNode,
}
export const ssrUtils = _ssrUtils
