import { isArray, isObject } from '@mini-vue3/shared'
import { createVNode, isVNode } from './vnode'

// 用于创建虚拟 DOM 节点（VNode）
export function h(type, propsOrChildren, children: any = null) {
  const l = arguments.length

  // 参数数量为 2 ：处理省略子节点或省略属性的场景
  // h('div', { class: 'foo' })
  // h('div', [h('span')])
  // h('div', h('span'))
  if (l === 2) {
    // 如果是对象且不是数组
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 虚拟节点，将 propsOrChildren 作为子节点
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      // 普通对象，将 propsOrChildren 视为属性对象
      return createVNode(type, propsOrChildren)
    }
    // 数组或其他类型，将 propsOrChildren 视为子节点
    else {
      return createVNode(type, null, propsOrChildren)
    }
  }
  // 参数数量大于 2 ：显式传递子节点的场景
  // h('div', { id: 'app' }, 'Hello')
  // h('div', {}, h('span'), h('p'))
  else {
    // 处理参数数量超过 3，则截取第三个及之后的参数作为子节点数组
    if (l > 3) {
      // eslint-disable-next-line prefer-rest-params
      children = Array.prototype.slice.call(arguments, 2)
    }
    // 处理参数数量为 3 且子节点是单个 VNode，则将子节点包装为数组
    else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
