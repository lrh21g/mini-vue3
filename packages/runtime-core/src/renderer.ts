/* eslint-disable ts/no-use-before-define */

import type { KeepAliveContext } from './components/KeepAlive'
import type { TeleportImpl, TeleportVNode } from './components/Teleport'
import { ReactiveEffect } from '@mini-vue3/reactivity'
import { invokeArrayFns, ShapeFlags } from '@mini-vue3/shared'
import { createAppAPI } from './apiCreateApp'
import { type ComponentInternalInstance, createComponentInstance, setupComponent } from './component'
import { resolveProps } from './componentProps'
import { renderComponentRoot, shouldUpdateComponent } from './componentRenderUtils'
import { updateSlots } from './componentSlots'
import { createHydrationFunctions } from './hydration'
import { queueJob } from './scheduler'
import {
  Comment,
  Fragment,
  isSameVNodeType,
  normalizeVNode,
  Text,
  type VNode,
  type VNodeProps,
} from './vnode'

export type ElementNamespace = 'svg' | 'mathml' | undefined

export interface RendererNode {
  [key: string | symbol]: any
}

export interface RendererElement extends RendererNode {}

type MoveFn = (
  vnode: any,
  container: RendererElement,
  anchor?: RendererNode | null,
  type?: any
) => void

type PatchFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor?: RendererNode | null,
  parentComponent?: ComponentInternalInstance | null,
) => void

type MountChildrenFn = (
  container: RendererElement,
  children: VNode[],
  anchor: RendererNode | null,
  start?: number
) => void

type PatchChildrenFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  rootComponent: ComponentInternalInstance | null
) => void

type UnmountFn = (
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
) => void

type UnmountChildrenFn = (
  children: VNode[],
  parentComponent: ComponentInternalInstance | null,
  start?: number
) => void

export type MountComponentFn = (
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => void

export interface RendererInternals<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  p: PatchFn
  um: UnmountFn
  m: MoveFn
  mt: MountComponentFn
  mc: MountChildrenFn
  pc: PatchChildrenFn
  o: RendererOptions<HostNode, HostElement>
}

export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  patchProp: (
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
  ) => void
  insert: (el: HostNode, parent: HostElement, anchor?: HostNode | null) => void
  remove: (el: HostNode) => void
  createElement: (
    type: string,
    namespace?: ElementNamespace,
    isCustomizedBuiltIn?: string,
    vnodeProps?: (VNodeProps & { [key: string]: any }) | null,
  ) => HostElement
  createText: (text: string) => HostNode
  setText: (node: HostNode, text: string) => void
  setElementText: (node: HostElement, text: string) => void
  createComment: (text: string) => HostNode
  parentNode: (node: HostNode) => HostElement | null
  nextSibling: (node: HostNode) => HostNode | null
  querySelector?: (selector: string) => HostElement | null
  firstChild?: (el: HostElement) => HostNode | null
}

// 判断当前组件是否是 keepAlive 组件
export const isKeepAlive = (vnode): boolean => !!vnode.type.__isKeepAlive

// 创建一个通用的渲染器，用于普通前端应用
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement,
>(renderOptions: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(renderOptions)
}

// 创建支持 SSR 水合的渲染器，用于 SSR（服务器端渲染）+ CSR（客户端水合） 的场景
export function createHydrationRenderer(renderOptions: RendererOptions<Node, Element>) {
  return baseCreateRenderer(renderOptions, createHydrationFunctions)
}

function baseCreateRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement,
>(
  renderOptions: RendererOptions<HostNode, HostElement>,
  createHydrationFns?: typeof createHydrationFunctions
)
function baseCreateRenderer(
  renderOptions: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions,
): any {
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    // eslint-disable-next-line unused-imports/no-unused-vars
    parentNode: hostParentNode,
    firstChild: hostFirstChild,
    nextSibling: hostNextSibling,
  } = renderOptions

  // 组件挂载和更新时，执行渲染操作
  // 通过创建响应式副作用函数来处理组件的渲染和更新逻辑
  const setupRenderEffect = (initialVNode, instance, container, anchor) => {
    const { beforeMount, mounted, beforeUpdate, updated } = initialVNode.type

    const componentUpdateFn = () => {
      const { bm, m, bu, u, proxy } = instance

      // 根据 instance.isMounted 判断组件状态，分别处理首次挂载和更新
      if (!instance.isMounted) {
        // 挂载阶段

        // 调用 renderComponentRoot 生成组件的渲染子树 subTree
        // renderComponentRoot 执行组件的 render 函数或模板编译后的代码，生成 VNode 树
        const subTree = instance.subTree = renderComponentRoot(instance)
        if (bm) {
          // 触发 onBeforeMounted （通过 Composition API 注册的 onBeforeMount 钩子）
          invokeArrayFns(bm)
        }
        // Options API 中的 beforeMount 钩子
        beforeMount && beforeMount.call(proxy)

        if (initialVNode.el) {
          // 调用 hydrateVNode 来进行“水合”操作（即复用 DOM 元素并同步到虚拟 DOM）
          hydrateVNode && hydrateVNode(initialVNode.el, subTree, instance)
        }
        else {
          // 调用 patch 将 VNode 转换为真实 DOM
          patch(null, subTree, container, anchor, instance)
        }
        initialVNode.el = subTree.el
        instance.isMounted = true

        if (m) {
          // 触发 onMounted （通过 Composition API 注册的 onMounted 钩子）
          invokeArrayFns(m)
        }
        // Options API 中的 mounted 钩子
        mounted && mounted.call(proxy)
      }
      else {
        // 更新阶段

        // 调用 renderComponentRoot 生成组件的渲染子树 subTree
        // renderComponentRoot 执行组件的 render 函数或模板编译后的代码，生成 VNode 树
        const nextTree = renderComponentRoot(instance)
        const prevTree = instance.subTree
        instance.subTree = nextTree

        if (bu) {
          // 触发 onBeforeUpdate （通过 Composition API 注册的 onBeforeUpdate 钩子）
          invokeArrayFns(bu)
        }
        // Options API 中的 beforeUpdate 钩子
        beforeUpdate && beforeUpdate.call(proxy)

        // 调用 patch 对比新旧 VNode，更新 DOM
        patch(prevTree, nextTree, container, anchor, instance)

        if (u) {
          // 触发 onUpdated （通过 Composition API 注册的 onUpdated 钩子）
          invokeArrayFns(u)
        }
        // Options API 中的 updated 钩子
        updated && updated.call(proxy)
      }
    }

    // 使用 ReactiveEffect 将 componentUpdateFn 包装为副作用函数，自动跟踪其依赖的响应式数据。
    // 当依赖数据变化时，副作用函数会被重新执行（通过 trigger 触发）。
    // 使用调度器 queueJob ，将更新任务推入异步队列，避免同步重复渲染。使用微任务（Promise.then）批量执行更新。
    const effect = new ReactiveEffect(componentUpdateFn, () => queueJob(instance.update))
    // 将 effect.run 绑定到 instance.update 上，并立即执行 update()，触发首次渲染或更新
    const update = instance.update = effect.run.bind(effect)
    update()
  }

  // 更新组件的属性（props）
  // 通过比较当前属性（props）和新的属性（newProps），来更新、添加或删除属性
  function patchComponentProps(props, newProps) {
    // 更新或添加属性
    for (const key in newProps) {
      const prop = props[key]
      const newProp = newProps[key]
      if (prop !== newProp) {
        props[key] = newProps[key]
      }
    }

    // 删除不存在于 newProps 中的属性
    for (const key in props) {
      if (!(key in newProps)) {
        delete props[key]
      }
    }
  }

  // 组件更新时，执行更新操作：用于更新组件实例的属性、插槽以及触发组件的更新过程
  function updateComponent(n1, n2) {
    // 将旧虚拟节点 n1 的组件实例赋值给新虚拟节点 n2，并将其存储在 instance 变量中
    const instance = n2.component = n1.component as ComponentInternalInstance
    const { props, attrs } = instance

    // 调用 shouldUpdateComponent 函数来决定是否需要更新组件
    if (shouldUpdateComponent(n1, n2)) {
      // 如果需要更新组件，则将组件实例的 vnode 属性更新为新的虚拟节点 n2
      instance.vnode = n2

      // 解析新的 props 和 attrs
      const {
        props: newProps,
        attrs: newAttrs,
      } = resolveProps(n2.type.props, n2.props)

      // 更新组件实例的 props 和 attrs ：比较旧的和新的属性，并根据需要添加、删除或更新属性
      patchComponentProps(props, newProps)
      patchComponentProps(attrs, newAttrs)

      // 更新组件的插槽内容：确保组件的插槽内容与新的虚拟节点中的子节点匹配
      updateSlots(instance, n2.children)

      // 触发组件更新，执行实际的 DOM 更新操作
      instance.update()
    }
    else {
      // 如果不需要更新，复用旧虚拟节点中的 comments 和 el（元素），并更新组件实例的 vnode 为新的虚拟节点 n2

      n2.comments = n1.comments
      n2.el = n1.el
      instance.vnode = n2
    }
  }

  // 处理文本节点更新
  const processText = (n1, n2, container, anchor) => {
    if (n1 === null) {
      const textNode = n2.el = hostCreateText(n2.children)
      hostInsert(textNode, container, anchor)
    }
    else {
      const el = n2.el = n1.el
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children)
      }
    }
  }

  // 处理注释节点更新
  const processCommentNode = (n1, n2, container, anchor) => {
    if (n1 === null) {
      hostInsert((n2.el = hostCreateComment(n2.children || '')), container, anchor)
    }
    else {
      // 不支持动态注释
      n2.el = n1.el
    }
  }

  // 处理 Fragment 更新
  const processFragment = (n1, n2, container, anchor, parentComponent) => {
    // 如果 n1 存在（即存在旧的 Fragment），则复用旧的锚点节点。否则，通过 hostCreateComment('') 创建新的注释节点作为锚点
    const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateComment('')
    const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateComment('')

    if (!n1) {
      // n1 不存在，表示首次渲染

      // 创建并插入其子节点
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)

      // 挂载子节点
      mountChildren(container, n2.children, fragmentEndAnchor, parentComponent)
    }
    else {
      // n1 存在，表示更新，则更新其子节点。
      patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent)
    }
  }

  // 处理组件挂载与更新
  const processComponent = (n1, n2, container, anchor, parentComponent) => {
    if (n1 === null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        // 如果当前组件是被缓存的组件，则激活
        (parentComponent.ctx as KeepAliveContext).activate(n2, container, anchor)
      }
      else {
        // 挂载组件
        mountComponent(n2, container, anchor, parentComponent)
      }
    }
    else {
      // 更新组件
      updateComponent(n1, n2)
    }
  }

  // 处理普通的 DOM 元素的更新
  // 根据旧节点（n1）和新节点（n2）的状态，决定是执行挂载操作还是更新操作。
  const processElement = (n1, n2, container, anchor, parentComponent) => {
    // 如果旧节点不存在，说明是首次挂载，则执行挂载操作
    if (n1 == null) {
      mountElement(n2, container, anchor, parentComponent)
    }
    // 否则，执行更新操作
    else {
      patchElement(n1, n2, parentComponent)
    }
  }

  // 挂载子节点：将虚拟节点 VNode 数组中的子节点挂载到目标容器中
  const mountChildren = (container, children, anchor, parentComponent, start = 0) => {
    for (let i = start; i < children.length; i++) {
      // 调用 normalizeVNode 方法对子节点进行规范化，确保其符合虚拟节点的结构。
      const child = children[i] = normalizeVNode(children[i])

      patch(null, child, container, anchor, parentComponent)
    }
  }

  // 挂载组件
  const mountComponent = (initialVNode, container, anchor, parentComponent) => {
    const componentOptions = initialVNode.type

    // 创建组件实例
    const instance = initialVNode.component = createComponentInstance(initialVNode, parentComponent)

    // 判断当前组件是否为 KeepAlive 组件，如果是，则注入内部方法
    if (isKeepAlive(componentOptions)) {
      (instance.ctx as KeepAliveContext).renderer = internals
    }

    // 初始化组件
    setupComponent(instance)

    // 组件挂载和更新时，执行渲染操作
    setupRenderEffect(initialVNode, instance, container, anchor)
  }

  // 用于将虚拟 DOM 元素节点（VNode）挂载到实际的 DOM 中
  const mountElement = (vnode: VNode, container: RendererElement, anchor: RendererNode, parentComponent) => {
    let el: RendererElement
    const { type, props, shapeFlag, children, transition } = vnode

    // 创建真实 DOM 元素
    // eslint-disable-next-line prefer-const
    el = vnode.el = hostCreateElement(type as string)

    // 如果是文本子节点
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置元素的文本内容
      hostSetElementText(el, children)
    }
    // 如果是数组子节点
    else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 调用 mountChildren 递归挂载子节点
      mountChildren(el, children, null, parentComponent)
    }

    // 如果 props 存在，遍历其键值对，调用 hostPatchProp 更新元素的属性
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    // 如果存在过渡配置，调用其 beforeEnter 钩子函数
    if (transition) {
      transition.beforeEnter(el)
    }

    // 将创建的元素插入到目标容器的指定位置
    hostInsert(el, container, anchor)

    // 如果存在过渡配置，调用其 enter 钩子函数
    if (transition) {
      transition.enter(el)
    }
  }

  // 用于更新元素节点的属性
  const patchProps = (props, newProps, el) => {
    // 如果新旧属性相同，直接返回
    if (props === newProps)
      return

    // 遍历新属性
    for (const key in newProps) {
      const prevProp = props[key]
      const nextProp = newProps[key]
      // 如果属性值不同，更新属性
      if (prevProp !== nextProp) {
        hostPatchProp(el, key, prevProp, nextProp)
      }
    }

    // 遍历旧属性
    for (const key in props) {
      // 如果旧属性在新属性中不存在，移除该属性
      if (!(key in newProps)) {
        hostPatchProp(el, key, props[key], null)
      }
    }
  }

  // 用于更新已存在的元素节点
  const patchElement = (n1, n2, parentComponent) => {
    // 获取旧节点的真实元素
    const el = n2.el = n1.el

    // 获取旧节点和新节点的属性
    const props = n1.props || {}
    const newProps = n2.props || {}

    // 更新属性
    patchProps(props, newProps, el)
    // 更新子节点
    patchChildren(n1, n2, el, null, parentComponent)
  }

  // 卸载子节点
  const unmountChildren: UnmountChildrenFn = (children, parentComponent, start = 0) => {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent)
    }
  }

  // 卸载节点
  const unmount = (vnode, parentComponent) => {
    const {
      el, // 对应的实际 DOM 元素
      type, // 节点类型（如 DOM 节点、组件等）
      shapeFlag, // 节点的形状标志（用于标识节点类型，如元素、组件等）
      component, // 如果虚拟节点是组件，包含该组件的实例信息
      children, // 该节点所对应的组件实例（如果是组件节点）
      transition, // 该节点的过渡效果
    } = vnode

    if (type === Fragment) {
      // Fragment 类型节点，没有根元素，只有多个子节点。需要递归卸载它的每个子节点

      children.forEach((vnode) => {
        unmount(vnode, parentComponent)
      })
    }

    if (shapeFlag & ShapeFlags.COMPONENT) {
      // 组件标记为 COMPONENT_SHOULD_KEEP_ALIVE ，表示组件应当被缓存，即使它从 DOM 中移除也应该保留其状态。这是 keep-alive 的一个标志
      // 则，调用 deactivate 函数将其激活状态设置为不活跃
      if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
        (parentComponent.ctx as KeepAliveContext).deactivate(vnode)
        return
      }

      const {
        bum, // 组件的 beforeUnmount 钩子
        um, // 组件的 unmounted 钩子
        subTree, // 组件的子树（即组件的虚拟 DOM）
      } = component
      bum && invokeArrayFns(bum)
      // 调用 unmount 递归卸载子树
      unmount(subTree, parentComponent)
      um && invokeArrayFns(um)
      return
    }

    // 如果节点有过渡效果（transition），则通过 transition.leave 执行离场过渡动画，动画结束后再移除元素；
    // 否则，直接移除元素
    const performRemove = () => hostRemove(el)
    if (transition) {
      transition.leave(el, performRemove)
    }
    else {
      performRemove()
    }
  }

  // 用于计算一个数值数组的最长递增子序列（Longest Increasing Subsequence，简称 LIS），返回该子序列在原数组中的索引。
  function getSequence(arr: number[]): number[] {
    // 初始化 result 数组，保存当前构造出的递增序列中每个位置的数组索引
    // 开始用第一个元素的索引 0 作为起始
    const result = [0]
    // 获取输入数组的长度
    const len = arr.length
    // p 数组用于记录前驱节点索引，初始时将 arr 复制一份
    // 后续 p[i] 会保存 arr[i] 在构造 LIS 过程中的前一个节点的索引
    const p = arr.slice(0)

    let start
    let end
    let middle

    // 遍历整个数组，i 表示当前处理的元素索引
    for (let i = 0; i < len; i++) {
      const arrI = arr[i]
      // 只处理非零值
      // 在 diff 算法中，0 通常表示该位置没有对应的旧节点（在 diff 中 0 表示未匹配）
      if (arrI !== 0) {
        // 获取当前 result 中最后一个索引
        const lastIndex = result[result.length - 1]
        // 如果当前元素大于 result 最后一个位置对应的值，则当前元素可以直接添加在现有递增序列后面
        if (arrI > arr[lastIndex]) {
          // 记录当前元素的前驱为 lastIndex
          p[i] = lastIndex
          // 将当前索引加入 result 中
          result.push(i)
          continue
        }

        // 如果当前元素不能直接添加到序列末尾，
        // 则利用二分查找确定当前元素可以替换 result 中的哪个位置，
        // 以保持 result 数组对应的值严格递增
        start = 0
        end = arr.length - 1
        while (start < end) {
          // 计算中间位置（取整）
          middle = (end + start) / 2 | 0
          // 如果当前元素大于中间位置对应的值，则搜索右半边
          if (arrI > arr[result[middle]]) {
            start = middle + 1
          }
          // 否则，向左半边收缩
          else {
            end = middle
          }
        }
        // 此时 start 为待替换的位置
        // 如果 result[start] 对应的值大于当前元素，则当前元素更适合作为较小的尾值
        if (arr[result[start]] > arrI) {
          // 将当前元素的前驱设置为 result[start - 1]（如果 start 为 0 则无前驱）
          start > 0 && (p[i] = result[start - 1])
          // 替换 result 中的元素为当前索引，以获得更优的尾值
          result[start] = i
        }
      }
    }

    // result 数组保存了最长递增子序列中每个位置对应的索引，
    // 但该序列仅仅是最后构造出的“候选”序列，不一定完整。
    // 接下来回溯 p 数组，重建完整的 LIS 索引序列。
    let i = result.length
    let last = result[i - 1]

    // 逆序遍历，利用 p 数组回溯每个位置的前驱索引，
    // 直到还原出完整的递增子序列的索引。
    while (i-- > 0) {
      result[i] = last
      last = p[last]
    }

    return result
  }

  // 比对（diff）新旧 VNode 列表（带 key 的子节点列表）
  const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent) => {
    let e1 = c1.length - 1 // 旧子节点列表的最后一个索引
    let e2 = c2.length - 1 // 新子节点列表的最后一个索引
    let i = 0 // 比较的索引，从 0 开始

    // 从头部开始比对新旧节点，直到遇到不同类型的节点为止
    // (a b) c
    // (a b) d e
    while (i <= e1 && i <= e2) {
      // 从头部开始，获取旧节点和新节点；对新节点进行标准化（normalizeVNode）
      const n1 = c1[i]
      const n2 = c2[i] = normalizeVNode(c2[i])

      if (isSameVNodeType(n1, n2)) {
        // 如果新旧节点类型相同，调用 patch 递归更新节点
        patch(n1, n2, container)
      }
      else {
        // 遇到第一个不同的节点，则停止从头部的对比
        break
      }

      i++
    }

    // 此时，索引 i 表示从头部已经对比完成的部分的结束位置

    // 从尾部开始对比新旧节点，直到遇到不同节点为止
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2) {
      // 从尾部开始，获取旧节点和新节点；对新节点进行标准化（normalizeVNode）
      const n1 = c1[e1]
      const n2 = c2[e2] = normalizeVNode(c2[e2])

      if (isSameVNodeType(n1, n2)) {
        // 如果新旧节点类型相同，调用 patch 递归更新节点
        patch(n1, n2, container)
      }
      else {
        // 遇到第一个不同的节点，则停止从头部的对比
        break
      }

      // 将旧数组和新数组的尾指针向前移动
      e1--
      e2--
    }

    // 经过，前后双端对比后，i - e1（旧节点）与 i - e2（新节点）之间的节点为“乱序”，需要进一步处理

    // 如果旧节点数组已经遍历完（i > e1），说明新节点中有额外的节点需要插入，需要插入 [i, e2] 之间节点
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        // 确认插入位置：
        // 如果 e2（新节点）的下一个索引值大于新节点列表的长度，则表示当前更新元素是最后一个，参照物为空，直接 appendChild
        // 如果 e2（新节点）的下一个索引值小于新节点列表的长度，则表示当前更新元素后还有元素，使用后面的元素作为参照物插入
        const anchor = nextPos < c2.length ? c2[nextPos].el : parentAnchor

        // 插入剩余的新节点，从 i 到 e2 的每个节点调用 patch 进行挂载操作
        while (i <= e2) {
          patch(null, c2[i], container, anchor)
          i++
        }
      }
    }

    // 如果新节点已经遍历完（i > e2），而旧节点仍有剩余，则卸载多余的旧节点
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > e2) {
      while (i <= e1) {
        // 卸载旧节点
        unmount(c1[i], parentComponent)
        i++
      }
    }

    // 当两边均还有剩余节点时，进入复杂 diff 算法（中间部分处理）
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
      // 此时 i 已经跳过前后相同的部分

      const s1 = i // 表示 c1 （旧节点）需要处理区间 [s1, e1] 的起始索引
      const s2 = i // 表示 c2 （新节点）需要处理区间 [s2, e2] 的起始索引
      let moved = false // 标记是否需要移动节点
      let pos = 0 // 用于记录新节点中最后一次遇到的最大索引
      let patched = 0 // 记录已经 patch 的节点数量

      // 建立新节点 key 到索引的映射
      // 使用旧节点列表在映射表中查找，如果存在则 patch，不存在则删除旧节点，最后多余的新节点则需要插入
      // e.g. { e: 2, d: 3, c: 4, h: 5 }
      const keyToNewIndexMap = new Map()

      // 遍历新节点区间，将每个节点的 key 与其索引存入映射表中
      for (let i = s2; i <= e2; i++) {
        const child = c2[i]
        keyToNewIndexMap.set(child.key, i)
      }

      // 计算需要 patch 的节点数量，表示新位置序列的数量
      const toBePatched = e2 - s2 + 1
      // 创建一个数组（初始化为 0），用于记录新节点中每个位置对应的旧节点索引
      // eslint-disable-next-line unicorn/no-new-array
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0)

      // 遍历需要处理旧节点的区间 [s1, e1]
      for (let i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        // 根据旧节点 key，从映射表中找到对应的新节点索引
        const newIndex = keyToNewIndexMap.get(prevChild.key)

        // 如果还有未 patch 的新节点（patched < toBePatched）
        if (patched < toBePatched) {
          if (newIndex) {
            // 将新的元素映射到老的元素的索引：
            // > 新的索引 = s2 +当前数组的索引
            // > 老的索引 = newIndexToOldMapIndex[当前数组索引]
            newIndexToOldIndexMap[newIndex - s2] = i + 1
            // 对应节点存在，进行 patch 更新
            patch(prevChild, c2[newIndex], container)

            // 判断是否存在节点移动：如果当前新索引小于前一次记录的 pos，则说明需要移动
            if (newIndex < pos && moved === false) {
              moved = true
            }
            else {
              pos = newIndex
            }
            patched++ // 增加已处理的计数
          }
          // 如果在新节点中没有找到对应的旧节点，则卸载旧节点
          else {
            unmount(prevChild, parentComponent)
          }
        }
        // 如果已经 patch 的节点数量超过需要 patch 的数量，说明剩余旧节点需要卸载
        else {
          unmount(prevChild, parentComponent)
        }
      }

      // 根据 newIndexToOldIndexMap 数组计算最长递增子序列（Longest Increasing Subsequence，LIS），返回该子序列在原数组中的索引。
      // 用于确定需要移动的节点，从而减少 DOM 操作，提高更新性能。
      const queue = getSequence(newIndexToOldIndexMap)
      // LIS 序列中最后一个元素的索引
      let j = queue.length - 1

      // 倒序遍历新节点中需要 patch 的区间，对未处理的节点进行插入或移动
      for (let i = toBePatched - 1; i >= 0; i--) {
        // 当前新节点在整体数组中的位置
        const lastIndex = i + s2
        // 当前要插入的元素
        const lastChild = c2[lastIndex]
        // 当前插入元素的下一个元素
        const nextPos = lastIndex + 1
        // 确定锚点：下一个节点的 DOM 元素或父级锚点
        const anchor = nextPos < c2.length ? c2[nextPos].el : parentAnchor

        if (newIndexToOldIndexMap[i] === 0) {
          // 如果对应位置为 0，说明在旧节点中找不到，执行新节点的挂载操作
          patch(null, lastChild, container, anchor)
        }
        else if (moved) {
          // 如果发生了移动，并且当前节点的位置不在最长递增子序列中，则执行移动操作
          //
          // e.g.
          // c1 = a b [c d e  ] f g
          // c2 = a b [e c d h] f g
          // 最终序列为 a b [e c d h] f g
          // 事实上，[c d] 两个节点不需要移动，相对于原序列 [c d e] 而言，可以直接把 e 插入到 c 前面就可以了
          //
          // 使用最长递增子序列，减少 DOM 插入操作
          // 如果当前索引和 newIndexToOldMapIndex 的索引的最大递增子序列不等，说明当前的元素需要插入
          if (i !== queue[j]) {
            move(lastChild, container, anchor)
          }
          // 当前节点在稳定序列中，不需要移动，则将指针向前移动
          else {
            j--
          }
        }
      }
    }
  }

  // 对简单“键控”子节点列表的对比更新算法
  // 即在新旧虚拟节点列表（children）之间进行比对，完成节点的更新、插入、移动和卸载，从而保证真实 DOM 与虚拟 DOM 的同步
  // eslint-disable-next-line unused-imports/no-unused-vars
  const patchSimpleKeyedChild = (c1, c2, container, parentAnchor, parentComponent) => {
    const oldChildren = c1 // 旧的子节点数组
    const newChildren = c2 // 新的子节点数组

    // 用来记录在旧子节点中，最后一次匹配的索引位置
    // 用于判断新节点是否出现了“倒序”情况，从而决定是否需要移动节点
    let lastIndex
    // 遍历新的子节点列表
    for (let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]
      // 用来表示是否在旧节点中找到了与当前新节点匹配的节点
      let find = false

      // 在旧节点列表中查找匹配的节点
      for (let j = 0; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if (isSameVNodeType(oldVNode, newVNode)) {
          find = true

          // 对节点进行更新（例如属性、事件、子节点等的更新）
          patch(oldVNode, newVNode, container)

          // 判断新节点在旧列表中的位置顺序
          // 如果当前匹配到的旧节点索引 j 小于之前记录的 lastIndex，说明当前节点在旧列表中的顺序不符合新列表的顺序（即出现了“倒序”），因此需要移动新节点对应的真实 DOM 元素。
          // 为了确定插入位置，取前一个新节点 preNode 的 DOM 元素的下一个兄弟节点作为锚点，再调用 hostInsert 将 newVNode.el 移动到正确的位置。
          if (j < lastIndex) {
            const preNode = newChildren[i - 1]
            if (preNode) {
              const anchor = hostNextSibling(preNode.el)
              hostInsert(newVNode.el, container, anchor)
            }
          }
          // 如果当前匹配节点的索引 j 大于或等于 lastIndex（即顺序是递增的），则更新 lastIndex 为当前 j，保持顺序参考
          else {
            lastIndex = j
          }
          break
        }
      }

      // 未找到匹配节点则进行挂载操作
      if (!find) {
        const preNode = newChildren[i - 1]
        let anchor
        if (preNode) {
          // 如果存在前一个新节点，则以其 DOM 元素的下一个兄弟节点作为插入位置
          anchor = hostNextSibling(preNode.el)
        }
        else {
          // 如果当前节点是新列表的第一个，则以容器中的第一个子节点作为锚点（或直接在开头插入）
          anchor = hostFirstChild && hostFirstChild(container)
        }
        patch(null, newVNode, container, anchor)
      }
    }

    // 遍历旧子节点，卸载在新列表中不存在的节点
    for (let i = 0; i < oldChildren.length; i++) {
      const oldNode = oldChildren[i]
      // 利用 find 检查每个旧节点在新的子节点列表中是否存在匹配（同样通过 isSameVNodeType 判断）
      const has = newChildren.find(newNode => isSameVNodeType(newNode, oldNode))
      if (!has) {
        // 如果找不到匹配的旧节点，则说明该节点已被移除
        unmount(oldNode, parentComponent)
      }
    }
  }

  // 双端对比的“键控”子节点更新
  // 同时从数组头尾开始对比新旧节点，可以高效地处理节点的插入、移动和删除
  // eslint-disable-next-line unused-imports/no-unused-vars
  const patchDoubleSideKeyedChild = (c1, c2, container, parentAnchor, parentComponent) => {
    let newStartIndex = 0 // 新子节点数组的开始索引
    let oldStartIndex = 0 // 旧子节点数组的开始索引
    let newEndIndex = c2.length - 1 // 新子节点数组的结束索引
    let oldEndIndex = c1.length - 1 // 旧子节点数组的结束索引

    let newStartNode = c2[newStartIndex] // 新子节点数组的开始节点
    let newEndNode = c2[newEndIndex] // 新子节点数组的结束节点
    let oldStartNode = c1[oldStartIndex] // 旧子节点数组的开始节点
    let oldEndNode = c1[oldEndIndex] // 旧子节点数组的结束节点

    while (newStartIndex <= newEndIndex && oldStartIndex <= oldEndIndex) {
      // 处理旧起始节点为空节点情况
      if (!oldStartNode) {
        oldStartNode = c1[++oldStartIndex]
      }
      // 处理旧尾节点为空节点情况
      else if (!oldEndNode) {
        oldEndNode = c1[--oldEndIndex]
      }
      // 新起始节点与旧起始节点匹配
      // 调用 patch 更新节点，指针同时向后移动
      else if (isSameVNodeType(newStartNode, oldStartNode)) {
        patch(oldStartNode, newStartNode, container)

        newStartNode = c2[++newStartIndex]
        oldStartNode = c1[++oldStartIndex]
      }
      // 新尾节点与旧尾节点匹配
      // 调用 patch 更新节点，指针同时向前移动
      else if (isSameVNodeType(newEndNode, oldEndNode)) {
        patch(oldEndNode, newEndNode, container)

        newEndNode = c2[--newEndIndex]
        oldEndNode = c1[--oldEndIndex]
      }
      // 新尾节点与旧起始节点匹配（交叉情况），说明该节点在新数组中从后面移到了前面
      // 调用 patch 更新节点后，调用 hostInsert 将旧起始节点对应的真实 DOM 元素移动到旧尾节点后面（通过获取 oldEndNode.el 的下一个兄弟节点作为锚点）
      else if (isSameVNodeType(newEndNode, oldStartNode)) {
        patch(oldStartNode, newEndNode, container)

        const anchor = oldEndNode ? hostNextSibling(oldEndNode.el) : null
        hostInsert(oldStartNode.el, container, anchor)

        newEndNode = c2[--newEndIndex]
        oldStartNode = c1[++oldStartIndex]
      }
      // 新起始节点与旧尾节点匹配（交叉情况），说明该节点从后移到了前面
      // 调用 patch 更新节点后，调用 hostInsert 将旧尾节点对应的 DOM 元素移动到旧起始节点（用作锚点）之前
      else if (isSameVNodeType(newStartNode, oldEndNode)) {
        patch(oldEndNode, newStartNode, container)
        hostInsert(oldEndNode.el, container, oldStartNode.el)

        newStartNode = c2[++newStartIndex]
        oldEndNode = c1[--oldEndIndex]
      }
      // 如果前面四种直接对比都未能匹配，则在旧数组中查找与当前新起始节点匹配的节点
      else {
        const oldIndex = c1.findIndex(oldNode => isSameVNodeType(oldNode, newStartNode))

        // 在旧数组中查找到匹配节点
        if (oldIndex > 0) {
          const oldNode = c1[oldIndex]
          // 调用 patch 更新找到的旧节点与新节点
          patch(oldNode, newStartNode, container)
          // 将匹配到的旧节点的 DOM 元素移动到旧起始节点之前（保证新节点的顺序）
          hostInsert(oldNode.el, container, oldStartNode.el)
          // 将该位置在旧数组中置为 undefined，防止后续重复匹配
          c1[oldIndex] = undefined
        }
        // 在旧数组中未查找到匹配节点
        else {
          // 调用 patch 挂载该节点
          patch(null, newStartNode, container, oldStartNode.el)
        }

        newStartNode = c2[++newStartIndex]
      }
    }

    // 旧节点全部处理完，新节点还有剩余
    // 根据 oldStartNode 的位置确定插入锚点，然后依次调用 patch 挂载剩下的新节点
    if (oldEndIndex < oldStartIndex && newStartIndex <= newEndIndex) {
      for (let i = newStartIndex; i <= newEndIndex; i++) {
        const anchor = oldStartNode ? oldStartNode.el : null
        patch(null, c2[i], container, anchor)
      }
    }
    // 新节点全部处理完，旧节点还有剩余
    // 剩余的旧节点在新节点中不再存在，应该调用 unmount 进行卸载，移除对应的 DOM 元素及其相关绑定
    else if (newEndIndex < newStartIndex && oldStartIndex <= oldEndIndex) {
      for (let i = oldStartIndex; i <= oldEndIndex; i++) {
        unmount(c1[i], parentComponent)
      }
    }
  }

  // 用于在虚拟 DOM 中移动节点
  // 通常在列表排序或动态组件更新时调用，以优化性能并减少不必要的 DOM 操作。
  const move: MoveFn = (vnode, container, anchor?, moveType?) => {
    const { el, shapeFlag, type, children } = vnode

    // 如果是组件类型，递归调用 move 处理其子树
    if (shapeFlag & ShapeFlags.COMPONENT) {
      move(vnode.component.subTree, container, anchor, moveType)
      return
    }

    // 如果是 Teleport 类型，暂时不处理
    if (shapeFlag & ShapeFlags.TELEPORT) {
      // ;(type as typeof TeleportImpl).move(vnode, container, anchor, internals)
      return
    }

    // 如果是 Fragment 类型，处理其子节点
    if (type === Fragment) {
      // 将 Fragment 的元素插入到容器中
      hostInsert(el, container, anchor)
      // 递归处理 Fragment 的子节点
      for (let i = 0; i < children.length; i++) {
        move(children[i], container, anchor, moveType)
      }
      // 将 Fragment 的锚点元素插入到容器中
      hostInsert(vnode.anchor, container, anchor)
      return
    }

    // 对于其他类型的节点，直接插入到容器中
    hostInsert(el, container, anchor)
  }

  // 更新虚拟 DOM 子节点
  // 通过比较新旧子节点的差异，决定是更新、卸载还是挂载子节点，以实现高效的 DOM 更新
  const patchChildren: PatchChildrenFn = (n1, n2, el, anchor, parentComponent) => {
    const c1 = n1 && n1.children // 获取旧节点
    const c2 = n2.children // 获取新节点

    const prevShapeFlag = n1 ? n1.shapeFlag : 0 // 获取旧节点的类型标记
    const shapeFlag = n2.shapeFlag // 获取新节点的类型标记

    // 如果新节点是文本子节点
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 如果旧节点是数组子节点，则卸载旧子节点
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1, parentComponent)
      }

      // 如果新旧子节点的文本不同，则更新文本
      if (c1 !== c2) {
        hostSetElementText(el, c2)
      }
    }
    else {
      // 如果旧节点是数组子节点
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 如果新节点也是数组子节点，则进行键值对的子节点更新
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 比对（diff）新旧 VNode 列表（带 key 的子节点列表）
          patchKeyedChildren(c1, c2, el, anchor, parentComponent)

          // 简单 diff
          // patchSimpleKeyedChild(c1, c2, el, anchor)

          // 双端 diff
          // patchDoubleSideKeyedChild(c1, c2, el, anchor)
        }
        // 如果新节点不是数组子节点，则卸载旧子节点
        else {
          unmountChildren(c1, parentComponent)
        }
      }
      else {
        // 如果旧节点是文本子节点
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 清空旧文本
          hostSetElementText(el, '')
        }

        // 如果新节点是数组子节点，则挂载新子节点
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(el, c2, anchor, parentComponent)
        }
      }
    }
  }

  /**
   * 用于处理虚拟 DOM 节点（VNode）的更新，根据不同的节点类型和变化，选择合适的更新操作
   * @param n1 旧的 VNode（更新前的节点）
   * @param n2 新的 VNode（更新后的节点）
   * @param container 容器（DOM 容器，用于挂载或更新节点）
   * @param anchor 锚点。指定新的节点插入到容器中的位置。如果为 null，表示直接附加到容器的末尾。
   * @param parentComponent 父组件实例（用于处理组件的生命周期、上下文等信息）
   */
  const patch: PatchFn = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
  ) => {
    // 如果 n1 和 n2 相同，说明节点没有变化，则直接返回，不需要执行更新操作
    if (n1 === n2) {
      return
    }

    // 如果 n1 存在，且 n1 和 n2 是不同类型的 vnode，则卸载旧的节点
    if (n1 && !isSameVNodeType(n1, n2)) {
      unmount(n1, parentComponent)
      n1 = null
    }

    const { type, shapeFlag } = n2

    switch (type) {
      // 文本节点
      case Text:
        // 处理文本节点更新
        processText(n1, n2, container, anchor)
        break
      // 注释节点
      case Comment:
        // 处理注释节点更新
        processCommentNode(n1, n2, container, anchor)
        break
      // Fragment 节点：表示没有根元素的组件
      case Fragment:
        // 处理 Fragment 节点更新
        processFragment(n1, n2, container, anchor, parentComponent)
        break
      default:
        if (shapeFlag & ShapeFlags.COMPONENT) {
          // 处理组件类型的更新
          processComponent(n1, n2, container, anchor, parentComponent)
        }
        else if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理普通的 DOM 元素的更新
          processElement(n1, n2, container, anchor, parentComponent)
        }
        else if (shapeFlag & ShapeFlags.TELEPORT) {
          // Teleport 组件：允许将子节点渲染到 DOM 中的其他位置
          ;(type as typeof TeleportImpl).process(
            n1 as TeleportVNode,
            n2 as TeleportVNode,
            container,
            anchor,
            parentComponent,
            internals,
          )
        }
    }
  }

  // 渲染函数
  const render = (vnode, container) => {
    // 判断传入的虚拟节点是否为空
    if (vnode == null) {
      // 如果虚拟节点为空，且容器中已有虚拟节点，则卸载旧的虚拟节点
      if (container._vnode) {
        unmount(container._vnode, null)
      }
    }
    // 如果虚拟节点不为空，进行 patch 操作（更新或挂载）
    else {
      patch(
        container._vnode || null, // 如果容器中有旧的虚拟节点，则作为第一个参数传入
        vnode, // 传入新的虚拟节点
        container, // 容器元素
      )
    }
    // 更新容器上的 _vnode 属性，保存当前虚拟节点
    container._vnode = vnode
  }

  // 存储渲染相关的内部操作函数，用于虚拟 DOM 的挂载、更新、卸载等操作。
  const internals: RendererInternals = {
    m: move, // 节点移动的操作
    um: unmount, // 卸载虚拟节点
    mt: mountComponent, // 挂载组件
    mc: mountChildren, // 挂载子节点
    pc: patchChildren, // 更新子节点
    p: patch, // 更新虚拟节点
    o: renderOptions, // 渲染选项
  }

  // hydrate 和 hydrateVNode 是用于客户端水合的函数
  // 水合是指将服务器渲染的静态 HTML 内容与客户端的动态行为结合起来，从而避免不必要的重新渲染。
  let hydrate: ReturnType<typeof createHydrationFunctions>[0] | undefined
  let hydrateVNode: ReturnType<typeof createHydrationFunctions>[1] | undefined
  if (createHydrationFns) {
    [hydrate, hydrateVNode] = createHydrationFns(
      internals as unknown as RendererInternals<Node, Element>,
    )
  }

  return {
    render,
    hydrate,
    createApp: createAppAPI(render),
  }
}
