import { createVNode, ssrUtils } from '@mini-vue3/runtime-core'
import { createApp } from '@mini-vue3/runtime-dom'
import { renderComponentVNode } from './render'

const { isVNode } = ssrUtils
// 将 Vue 组件或应用实例渲染为 HTML 字符串
export async function renderToString(
  input,
): Promise<string> {
  // 处理直接传入 VNode 的情况
  // 通过 createApp 创建临时应用实例，将 VNode 包装为根组件的 render 函数
  // 递归调用 renderToString 处理新创建的应用实例
  if (isVNode(input)) {
    return renderToString(createApp({ render: () => input }))
  }

  // 处理应用实例或组件
  // 创建根 VNode：createVNode 将根组件转换为初始 VNode。
  // 渲染组件树：调用 renderComponentVNode（见之前解析）递归生成 HTML。
  const vnode = createVNode(input._component, input._props) as any
  return renderComponentVNode(vnode)
}
