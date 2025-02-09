import { createComponentInstance, setupComponent } from './component'
import { renderComponentRoot } from './componentRenderUtils'
import { isVNode, normalizeVNode } from './vnode'

export {
  Component,
  ComponentInternalInstance,
  Data,
  registerRuntimeCompiler,
  RuntimeCompilerOptions,
  SetupContext,
} from './component'

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

const _ssrUtils = {
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
  isVNode,
  normalizeVNode,
}
export const ssrUtils = _ssrUtils
