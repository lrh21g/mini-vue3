/* eslint-disable ts/no-use-before-define */
/* eslint-disable symbol-description */
import type { Component, ComponentInternalInstance, Data } from './component'
import type { TransitionHooks } from './components/BaseTransition'
import type { KeepAliveContext } from './components/KeepAlive'
import type { RendererElement, RendererNode } from './renderer'

import { isArray, isFunction, isObject, isString, ShapeFlags } from '@mini-vue3/shared'
import { isTeleport, type TeleportImpl } from './components/Teleport'

export type VNodeTypes =
  | string
  | VNode
  | object
  | Component
  | typeof Text
  | typeof Comment
  | typeof Fragment
  | typeof TeleportImpl

export interface VNodeProps {
  key?: string | number | symbol
}

export interface VNode<
  HostNode = RendererNode,
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any },
> {
  __v_isVNode: boolean // 标识符，表明该对象是一个 VNode
  type: VNodeTypes // 节点类型（如 DOM 节点、组件等）
  props: (VNodeProps & ExtraProps) | null // 节点的 props，包含了传递给组件或元素的属性
  key: string | number | symbol | null | undefined // 唯一的标识符，通常用于在渲染中识别节点

  children: any // 子节点，可以是元素、文本、组件等
  component: ComponentInternalInstance | null // 该节点所对应的组件实例（如果是组件节点）

  el: HostElement | null // 对应的实际 DOM 元素
  anchor: HostNode | null // 锚点节点，用于控制插入位置
  target: HostElement | null // 目标元素，可能用于插槽或 teleport 等
  targetAnchor: HostNode | null // 目标锚点节点

  shapeFlag: number // 节点的形状标志（用于标识节点类型，如元素、组件等）
  patchFlag: number // 用于优化的更新标志

  transition?: TransitionHooks | null // 该节点的过渡效果
  keepAliveInstance?: KeepAliveContext // 该节点的 keepAlive 实例
}

export { createVNode as createElementVNode }

export function createVNode(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
) {
  // 描述虚拟节点的类型
  const shapeFlag
    = isString(type)
      ? ShapeFlags.ELEMENT
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isFunction(type)
          ? ShapeFlags.FUNCTIONAL_COMPONENT
          : isObject(type)
            ? ShapeFlags.STATEFUL_COMPONENT
            : 0

  const vnode = {
    __v_isVNode: true,
    type,
    props,
    key: props && props.key,
    children,
    component: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    shapeFlag,
    patchFlag,
  }

  normalizeChildren(vnode, children)

  return vnode
}

export const isVNode = val => val && !!val.__v_isVNode

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

// 将传入的 children 规范化为合法的虚拟节点
// 规范化 children（子节点），确保其符合虚拟节点的结构，并根据子节点类型更新 vnode 的 shapeFlag 和 children 属性。
export function normalizeChildren(vnode, children) {
  let type = 0
  const { shapeFlag } = vnode

  if (children === null) {
    // 没有子节点，设置为 null
    children = null
  }
  else if (isArray(children)) {
    // 设置 type 为 ARRAY_CHILDREN，表示多个子节点
    type = ShapeFlags.ARRAY_CHILDREN
  }
  else if (isObject(children)) {
    // eslint-disable-next-line no-empty
    if (shapeFlag & ShapeFlags.ELEMENT) {}
    else {
      type = ShapeFlags.SLOTS_CHILDREN
    }
  }
  else if (isFunction(children)) {
    type = shapeFlag.PROPS_CHILDREN
    children = { default: children }
  }
  else {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }

  vnode.children = children
  vnode.shapeFlag |= type
}

export const Text = Symbol()

export const Comment = Symbol()

export const Fragment = Symbol()

// 将传入的 child 节点规范化为一个合法的虚拟节点（VNode）
export function normalizeVNode(child) {
  if (child === null || typeof child === 'boolean') {
    // 如果 child 为 null 或 false，则创建一个空的注释节点（Comment）
    return createVNode(Comment)
  }
  else if (isArray(child)) {
    // 如果 child 是一个数组，则创建一个 Fragment 节点，并传入该数组的副本作为 children
    // child.slice() 是用来创建数组的副本，避免直接修改原数组
    return createVNode(Fragment, null, child.slice())
  }
  else if (typeof child === 'object') {
    // 如果 child 是一个对象，则直接返回该对象，表示已经是一个合法的虚拟节点
    return child
  }

  // 如果 child 是一个普通值（字符串、数字等），则创建一个文本节点（Text），并传入该值作为 children
  return createVNode(Text, null, String(child))
}

export function createTextVNode(text: string = '', patchFlag = 0) {
  return createVNode(Text, null, String(text), patchFlag)
}

export function createCommentVNode(text) {
  return createVNode(Comment, null, text)
}
