import type { JSChildNode, SimpleExpressionNode } from './ast'
import { NodeTypes } from './ast'
import { CREATE_ELEMENT_VNODE, CREATE_VNODE } from './runtimeHelpers'

export function getVNodeHelper(isComponent: boolean) {
  return isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}

export function isStaticExp(p: JSChildNode): p is SimpleExpressionNode {
  return p.type === NodeTypes.SIMPLE_EXPRESSION && p.isStatic
}
