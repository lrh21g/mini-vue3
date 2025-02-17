/* eslint-disable unused-imports/no-unused-vars */
import type { ComponentRenderContext } from '../componentPublicInstance'
import type { RendererInternals } from '../renderer'
import { isArray, isString, ShapeFlags } from '@mini-vue3/shared'
import { isAsyncWrapper } from '../apiAsyncComponent'
import { getComponentName, getCurrentInstance } from '../component'
import { isVNode } from './../vnode'

// 定义匹配规则类型：字符串、正则表达式或数组
type MatchPattern = string | RegExp | (string | RegExp)[]

// KeepAlive 上下文扩展
export interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals // 渲染器内部方法
  activate: (
    vnode: any,
    container: any,
    anchor: any,
  ) => void // 激活方法
  deactivate: (vnode: any) => void // 停用方法
}

// 获取内部子节点（处理 Suspense 组件）
function getInnerChild(vnode) {
  return vnode.shapeFlag & ShapeFlags.SUSPENSE
    ? vnode.ssContent! // 返回 Suspense 的实际内容
    : vnode // 普通组件直接返回
}

// 匹配组件名称： 匹配 name 是否在 pattern 中
function matches(pattern: MatchPattern, name: string) {
  // 数组：递归检查每个元素
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name))
  }
  // 字符串：按逗号分割后检查包含关系
  else if (isString(pattern)) {
    return pattern.split(',').includes(name)
  }
  // 正则表达式：使用 test 方法匹配
  else if (pattern.test) {
    return pattern.test(name)
  }
  return false
}

export const KeepAliveImpl = {
  name: 'KeepAlive',
  __isKeepAlive: true, // 自定义标识属性
  props: {
    include: [RegExp, String, Array], // 包含规则
    exclude: [RegExp, String, Array], // 排除规则
    max: [String, Number], // 最大缓存数
  },
  setup(props, { slots }) {
    // 缓存数据结构：Map<ComponentType, VNode>
    const cache = new Map()
    // 当前活动的 VNode
    let current
    // 获取当前组件实例
    const instance = getCurrentInstance()
    // 获取共享上下文（包含渲染器方法）
    const sharedContext = instance.ctx as KeepAliveContext
    // 解构渲染器方法
    const {
      renderer: {
        m: move, // DOM 移动方法
        o: {
          createElement, // 元素创建方法
        },
      },
    } = sharedContext

    // 创建隐藏容器（用于存储非活跃组件的DOM）
    const storageContainer = createElement('div')

    // 定义停用方法：将 DOM 移动到隐藏容器
    sharedContext.deactivate = (vnode) => {
      move(vnode, storageContainer)
    }
    // 定义激活方法：将 DOM 移回原容器
    sharedContext.activate = (vnode, container, anchor) => {
      move(vnode, container, anchor)
    }

    // 返回渲染函数
    return () => {
      // 没有默认插槽内容时返回 null
      if (!slots.default) {
        return null
      }

      // 获取子节点数组，并取第一个子节点（KeepAlive只缓存单个组件
      const children = slots.default()
      const rawVNode = children[0]

      // 多子节点不缓存
      if (children.length > 1) {
        current = null
        return children
      }
      // 非 VNode 或非有状态组件不缓存
      else if (!isVNode(rawVNode) || (!(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) /** && !(rawVNode.shapeFlag & ShapeFlags.SUSPENSE) */)) {
        current = null
        return rawVNode
      }

      // 获取实际子节点（处理 Suspense）
      const vnode = getInnerChild(rawVNode)
      // 获取组件类型
      const comp = vnode.type

      // 获取组件名称（处理异步组件）
      const name = getComponentName(
        isAsyncWrapper(comp)
          ? comp.__asyncResolved
          : comp,
      )

      const { include, exclude, _max } = props

      // 检查包含/排除规则
      // 如果 include 中的值和当前 VNode Name匹配说明需要 keepAlive
      // 如果 exclude 中的值和当前 VNode Name匹配说明不需要 keepAlive
      // name 不存在不需要 keepAlive
      if (
        (include && (!name || !matches(include, name)))
        || (exclude && name && matches(exclude, name))
      ) {
        current = null
        // 不满足条件直接返回
        return rawVNode
      }

      // 缓存查询
      const cachedVNode = cache.get(rawVNode.type)
      // 命中缓存：复用组件实例
      if (cachedVNode) {
        rawVNode.component = cachedVNode.component
        // 设置组件保持激活状态标志（二进制位运算）
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
      }
      // 未命中：存入缓存
      else {
        cache.set(rawVNode.type, rawVNode)
      }

      // 设置组件应被缓存标志
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE

      // 关联 KeepAlive 实例
      rawVNode.keepAliveInstance = instance

      // 更新当前 VNode
      current = vnode
      return rawVNode
    }
  },
}

export const KeepAlive = KeepAliveImpl as any
