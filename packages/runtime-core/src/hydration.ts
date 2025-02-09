/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable ts/no-use-before-define */
import type { ComponentInternalInstance } from './component'
import type { RendererInternals } from './renderer'
import { isOn, ShapeFlags } from '@mini-vue3/shared'
import { Fragment, normalizeVNode, type VNode } from './vnode'

// 定义 DOM 节点类型
enum DOMNodeTypes {
  ELEMENT = 1,
  TEXT = 3,
  COMMENT = 8,
}

// 检查给定的 node 是否是一个注释节点
const isComment = (node: Node): node is Comment => node.nodeType === DOMNodeTypes.COMMENT

// 用于在客户端渲染时，将服务端渲染（SSR）生成的 HTML 与客户端的虚拟 DOM 进行同步，以实现“水合”（hydration）过程
export function createHydrationFunctions(
  rendererInternals: RendererInternals<Node, Element>,
) {
  const {
    mt: mountComponent,
    p: patch,
    o: {
      patchProp,
      nextSibling,
      parentNode,
      remove,
      insert,
      createComment,
    },
  } = rendererInternals

  // 在容器中查找子节点，并开始水合过程
  const hydrate = (vnode, container: Element) => {
    // 如果容器中有子节点，则开始水合操作
    if (container.hasChildNodes()) {
      // 从容器的第一个子节点开始水合
      hydrateNode(container.firstChild!, vnode, null)
    }
  }

  // 处理单个节点的水合
  const hydrateNode = (
    node: Node, // 当前 DOM 节点
    vnode: VNode, // 对应的虚拟 DOM 节点
    parentComponent: ComponentInternalInstance | null, // 父组件实例
  ) => {
    // 判断当前节点是否是一个 Fragment 起始节点
    const isFragmentStart = isComment(node) && node.data === '['

    // 将真实 DOM 节点赋值给虚拟 DOM
    vnode.el = node

    const domType = node.nodeType
    // 解构虚拟节点的类型、属性、子节点和形状标志
    const { type, props, children, shapeFlag } = vnode

    // 用来存储下一个节点的引用
    let nextNode: Node | null = null

    // 根据虚拟 DOM 节点的类型，决定如何处理水合
    switch (type) {
      case Text:
        // 如果是文本节点，且当前 DOM 节点类型不是文本节点
        if (domType !== DOMNodeTypes.TEXT) {
          // TODO 处理不匹配的节点
        }
        // 如果文本内容不一致，打印警告并同步文本内容
        else {
          if ((node as Text).data !== children) {
            console.warn('文本不一致'
              + `\n服务端: ${vnode.children}`
              + `\n客户端: ${(node as Text).data}`,
            )
            ; (node as Text).data = children as string
          }
        }
        // 获取下一个兄弟节点
        nextNode = nextSibling(node)
        break
      case Comment:
        // 如果是注释节点，且它不是 Fragment 起始节点
        if (domType !== DOMNodeTypes.COMMENT || isFragmentStart) {
          // TODO 处理不匹配的节点
        }
        else {
          // 获取下一个兄弟节点
          nextNode = nextSibling(node)
        }
        break
      case Fragment:
        // 如果是 Fragment 类型的虚拟节点，并且当前节点不是 Fragment 起始节点
        if (!isFragmentStart) {
          // TODO 需要错误处理
        }
        else {
          // 调用 hydrateFragment 来处理 Fragment 类型的节点
          nextNode = hydrateFragment(
            node as Comment,
            vnode,
            parentComponent,
          )
        }
        break
      default:
        // 如果是组件类型
        if (shapeFlag & ShapeFlags.COMPONENT) {
          // 获取父容器节点
          const container = parentNode(node)!
          // 挂载组件
          mountComponent(vnode, container, null, parentComponent)
          // 获取下一个兄弟节点
          nextNode = nextSibling(node)
        }
        else if (shapeFlag & ShapeFlags.ELEMENT) {
          // 如果是元素节点，且当前 DOM 节点的类型和虚拟节点不一致
          if (domType !== DOMNodeTypes.ELEMENT || (vnode.type as string).toLowerCase() !== (node as Element).tagName.toLowerCase()) {
            // TODO 处理不匹配的节点
          }
          else {
            // 处理元素节点的水合
            nextNode = hydrateElement(
              node as Element,
              vnode,
              parentComponent,
            )
          }
        }
    }
    return nextNode
  }

  // 处理元素节点的水合，包括属性和子节点的同步
  const hydrateElement = (
    el: Element, // 实际的 DOM 元素
    vnode: VNode, // 对应的虚拟 DOM 节点
    parentComponent: ComponentInternalInstance | null, // 父组件实例
  ) => {
    // 解构虚拟 DOM 节点的子节点、属性和形状标志
    const { children, props, shapeFlag } = vnode

    // 如果虚拟 DOM 节点有属性
    if (props) {
      // 遍历属性并应用到实际 DOM 元素
      for (const key in props) {
        if (isOn(key)) {
          // 对比属性并更新元素的属性
          patchProp(el, key, null, props[key])
        }
      }
    }

    // 如果虚拟节点有子节点且其类型为数组
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 调用 hydrateChildren 处理子节点的水合
      let next = hydrateChildren(el.firstChild, children, el, parentComponent)

      // 如果有剩余的节点，需要移除它们
      if (next) {
        while (next) {
          const cur = next
          next = nextSibling(next) // 获取下一个兄弟节点
          remove(cur)// 移除当前节点
        }
      }
      // 如果是文本子节点，则更新文本内容
      else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        if (el.textContent !== children) {
          console.warn('文本不一致'
            + `\n服务端: ${vnode.children}`
            + `\n客户端: ${el.textContent}`,
          )
          el.textContent = children // 更新元素的文本内容
        }
      }
    }

    return nextSibling(el)
  }

  // 处理片段节点的水合
  const hydrateFragment = (
    _node: Comment,
    _vnode: VNode,
    _parentComponent: ComponentInternalInstance | null,
  ) => {
    return null
  }

  // 递归处理子节点的水合
  const hydrateChildren = (
    node: Node | null, // 当前 DOM 节点
    children: VNode[], // 虚拟节点的子节点数组
    container: Element, // 容器元素
    parentComponent: ComponentInternalInstance | null, // 父组件实例
  ) => {
    // 遍历虚拟 DOM 节点的子节点数组
    for (let i = 0; i < children.length; i++) {
      // 规范化子节点
      const child = normalizeVNode(children[i])

      if (node) {
        // 如果当前 DOM 节点存在，调用 hydrateNode 进行处理
        node = hydrateNode(node, child, parentComponent)
      }
      else {
        // 如果没有节点，则调用 patch 挂载新节点
        patch(null, child, container, null, parentComponent)
      }
    }
    return node
  }

  return [hydrate, hydrateNode] as const
}
