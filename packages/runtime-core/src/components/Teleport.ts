import type { ComponentInternalInstance } from '../component'
import type { RendererElement, RendererInternals, RendererNode } from '../renderer'
import type { VNode } from '../vnode'

export interface TeleportProps {
  to: string | null | undefined
  disabled?: boolean
}

export type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps>

export const isTeleport = (type: any): boolean => type.__isTeleport

export const TeleportImpl = {
  __isTeleport: true,
  process(
    _n1: TeleportVNode | null,
    _n2: TeleportVNode,
    _container,
    _anchor,
    _parentComponent: ComponentInternalInstance | null,
    _internals: RendererInternals,
  ) {},

  move() { },
}
