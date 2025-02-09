import type { RendererElement } from './../renderer'

export interface TransitionHooks<HostElement = RendererElement> {
  beforeEnter: (el: HostElement) => void
  enter: (el: HostElement) => void
  leave: (el: HostElement, remove: () => void) => void
}
