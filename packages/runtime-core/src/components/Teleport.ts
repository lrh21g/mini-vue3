/* eslint-disable unused-imports/no-unused-vars */
import type { ComponentInternalInstance } from './../component'
import type { RendererElement, RendererInternals, RendererNode, RendererOptions } from './../renderer'
import type { VNode } from './../vnode'
import { isString, ShapeFlags } from '@mini-vue3/shared'

// 判断是否为 Teleport 组件（通过 __isTeleport 标识）
export const isTeleport = (type: any): boolean => type.__isTeleport

// 判断 Teleport 是否被禁用（通过 props.disabled 属性）
const isTeleportDisabled = (props: VNode['props']): boolean => props && (props.disabled || props.disabled === '')

// Teleport 的 VNode 类型定义
export type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps>

// Teleport 的 props 类型
export interface TeleportProps {
  to: string | null | undefined // 目标选择器
  disabled?: boolean // 是否禁用
}

function resolveTarget<T = RendererElement>(
  props: TeleportProps,
  select: RendererOptions['querySelector'],
): T | null {
  // 获取to属性
  const targetSelector = (props && props.to)!

  if (isString(props.to)) {
    // 渲染器未提供 querySelector 时警告
    if (!select) {
      console.warn('querySelector 不能为空')
      return null
    }
    // 执行 DOM 查询
    else {
      return select(targetSelector) as any
    }
  }
  else {
    if (!props.to)
      console.warn('Teleport 参数 to 不能为空')
    return targetSelector as any
  }
}

export const TeleportImpl = {
  __isTeleport: true, // Teleport 组件类型标识
  process(
    n1: TeleportVNode, // 旧 VNode
    n2: TeleportVNode, // 新VNode
    container, // 父容器
    anchor, // 锚点
    parentComponent: ComponentInternalInstance,
    internals: RendererInternals, // 渲染器内部方法
  ) {
    const {
      p: patch, // 通用 patch 方法
      mc: mountChildren, // 挂载子节点
      pc: patchChildren, // 更新子节点
      m: move, // 移动 DOM 节点
      o: {
        querySelector, // DOM 查询方法
        createText, // 创建文本节点
        insert, // DOM 插入方法
      },
    } = internals

    // 首次挂载逻辑
    if (!n1) {
      const {
        children,
        shapeFlag,
      } = n2

      const disabled = isTeleportDisabled(n2.props)

      // 创建占位符节点
      const placeholder = (n2.el = createText(' teleport start ')) // 创建开始锚点
      const mainAnchor = (n2.anchor = createText(' teleport end ')) // 创建结束锚点

      // 插入占位符到原容器
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      // 解析目标容器
      const target = (n2.target = resolveTarget(
        n2.props!,
        querySelector,
      ))
      // 目标锚点：作为 Teleport 内容在目标容器中的插入位置标记
      const targetAnchor = (n2.targetAnchor = createText(' targetAnchor'))

      // 插入目标锚点
      if (target) {
        insert(targetAnchor, target)
      }

      // 定义子节点挂载方法
      const mount = (container: RendererElement, anchor: RendererNode) => {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 挂载子节点数组
          mountChildren(
            container,
            children,
            anchor,
          )
        }
      }

      // 禁用状态：在原容器挂载
      if (disabled) {
        mount(container, mainAnchor)
      }
      // 启用状态：在目标容器挂载
      else if (target) {
        mount(target, targetAnchor)
      }
    }
    else {
      // 对比更新子节点
      patchChildren(n1, n2, container, anchor, parentComponent)

      // 目标位置变化时的处理
      if (n1.props!.to !== n2.props!.to) {
        const newTarget = (querySelector && querySelector(n2.props!.to!))
        // 移动所有子节点到新目标
        n2.children.forEach(c => move(c, newTarget!))
      }
    }
  },
  move() { },
}

export const Teleport = TeleportImpl
