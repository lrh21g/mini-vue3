import type { Data } from './component'
import { isOn, ShapeFlags } from '@mini-vue3/shared'
import { normalizeVNode } from './vnode'

// 比较属性是否有变化
export function hasPropsChanged(preProps, nextProps) {
  // 使用 Object.keys 获取前后两个属性对象的键数组
  const preKeys = Object.keys(preProps)
  const nextKeys = Object.keys(nextProps)

  // 如果属性数量不同，则需要更新
  if (preKeys.length !== nextKeys.length)
    return true

  // 遍历 nextKeys，如果在 preProps 中对应的属性值与 nextProps 中的属性值不同，则需要更新组件
  for (const key of nextKeys) {
    if (preProps[key] !== nextProps[key])
      return true
  }

  return false
}

// 判断组件是否需要更新
// 通过比较前后两个虚拟节点的子节点和属性，来决定是否触发组件的更新
export function shouldUpdateComponent(preVNode, nextVNode) {
  const { props: preProps } = preVNode
  const { props: nextProps } = nextVNode

  // 如果前后两个虚拟节点的子节点不同，则需要更新组件
  if (preVNode.children !== nextVNode.children) {
    return true
  }

  // 如果前后两个虚拟节点的属性相同，则不需要更新组件
  if (preProps === nextProps) {
    return false
  }

  // 如果前一个虚拟节点的属性不存在，而后一个虚拟节点的属性存在，则需要更新组件
  if (!preProps) {
    return !!nextProps
  }

  // 如果后一个虚拟节点的属性不存在，则需要更新组件
  if (!nextProps) {
    return true
  }

  // 比较前后两个虚拟节点的属性是否有变化
  return hasPropsChanged(preProps, nextProps)
}

// 函数式组件属性过滤：筛选出需要透传的属性（class、style、事件监听器）
function getFunctionalFallthrough(attrs: Data): Data | undefined {
  let res: Data | undefined
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ; (res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}

// 生成组件的根 VNode
export function renderComponentRoot(instance) {
  // 初始化渲染结果
  let result
  // 初始化透传属性
  let fallthroughAttrs

  // 获取组件实例的相关属性
  const {
    type: Component,
    vnode,
    render,
    proxy,
    setupState,
    ctx,
    data,
    props,
    attrs,
    emit,
    slots,
    inheritAttrs,
  } = instance

  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    // 有状态组件

    const proxyToUse = proxy
    // 调用组件的 render 函数，并使用 normalizeVNode 标准化虚拟节点
    result = normalizeVNode(
      render!.call(
        proxyToUse,
        proxyToUse!,
        props,
        setupState,
        data,
        ctx,
      ),
    )
    fallthroughAttrs = attrs
  }
  else {
    // 函数式组件

    const render = Component
    // 调用组件的 render 函数生成虚拟节点
    result = normalizeVNode(
      render.length > 1
        ? render(props, { attrs, slots, emit })
        : render(props, null),
    )
    fallthroughAttrs = Component.props
      ? attrs
      : getFunctionalFallthrough(attrs)
  }

  // 如果需要透传属性且 inheritAttrs 不为 false，则合并属性
  if (fallthroughAttrs && inheritAttrs !== false) {
    result.props = {
      ...result.props,
      ...fallthroughAttrs,
    }
  }

  return result
}
