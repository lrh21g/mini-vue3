import type { ComponentRenderContext } from '../componentPublicInstance'
import type { RendererInternals } from '../renderer'

export interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals
  activate: (
    vnode: any,
    container: any,
    anchor: any,
  ) => void
  deactivate: (vnode: any) => void
}
