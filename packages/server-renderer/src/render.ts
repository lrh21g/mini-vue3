/* eslint-disable style/no-mixed-operators */
/* eslint-disable unused-imports/no-unused-vars */
import type {
  ComponentInternalInstance,
  VNode,
} from '@mini-vue3/runtime-core'
import {
  Comment,
  Fragment,
  ssrUtils,
  Text,
} from '@mini-vue3/runtime-core'
import {
  escapeHtml,
  includeBooleanAttr,
  isArray,
  isBooleanAttr,
  isFunction,
  isOn,
  isPromise,
  isSSRSafeAttrName,
  isString,
  isVoidTag,
  ShapeFlags,
} from '@mini-vue3/shared'

const {
  setupComponent,
  renderComponentRoot,
  createComponentInstance,
  isVNode,
  normalizeVNode,
} = ssrUtils

// 元素节点渲染：将虚拟 dom 渲染成 HTML 字符
function renderElementVNode(vnode: VNode, parentComponent): string {
  const { type: tag, props, children } = vnode

  // 构建标签开头（如 `<div`）
  let ret = `<${String(tag)}`

  // 处理属性
  if (props) {
    ret += renderAttrs(props)
  }

  // 判断是否为自闭合标签（如 `<img/>`），自闭合标签直接结束
  if (isVoidTag(String(tag))) {
    ret += '/>'
    return ret
  }

  ret += '>' // 标签闭合（如 `<div>`）

  // 处理子节点
  if (children) {
    if (isArray(children)) {
      ret += renderVNodeChildren(children, parentComponent)
    }
    else if (isString(children)) {
      ret += children // 文本子节点直接拼接
    }
  }

  ret += `</${String(tag)}>` // 添加结束标签

  return ret
}

const isShouldIgnoreProps = prop => ['ref', 'key'].includes(prop)

// 生成 props
function renderAttrs(props) {
  let ret = ''
  for (const key in props) {
    const value = props[key]

    // 忽略 ref、key 和事件
    // 服务端渲染无需考虑事件绑定，直接忽略；组件运行时，相关属性不需要生成服务端渲染，直接忽略
    if (isShouldIgnoreProps(key) || isOn(key)) {
      continue
    }

    // TODO 此处需处理 class 和 Style,因为有可能它们的值是 Object 需要解析成字符

    // 生成动态参数
    ret += renderDynamicAttr(key, value)
  }
  return ret
}

// 生成动态参数
function renderDynamicAttr(key, value) {
  // 布尔属性（如 disabled）
  if (isBooleanAttr(key)) {
    return includeBooleanAttr(value) ? ` ${key}` : ''
  }
  // 安全属性名检测
  else if (isSSRSafeAttrName(key)) {
    return value === ''
      ? ` ${key}`
      : ` ${key}="${escapeHtml(value)}"` // 对 value 进行转义，防止 xss 攻击
  }
  // 非安全属性的情况
  else {
    console.warn(`[@mini-vue/server-renderer] 渲染不安全的属性名称: ${key}`)
  }

  return ''
}

// 组件节点渲染：将组件渲染成html字符串
export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
): string | Promise<string> {
  // 创建组件实例
  const instance = createComponentInstance(vnode, parentComponent)

  // 初始化组件（SSR 模式）
  const res = setupComponent(instance, true /* isSSR */)

  // 处理异步 setup
  const hasAsyncSetup = isPromise(res)
  if (hasAsyncSetup) {
    return res.then(() => renderComponentSubTree(instance)) as any
  }

  return renderComponentSubTree(instance) as any
}

// 组件子树渲染
function renderComponentSubTree(instance) {
  const Comp = instance.type

  // 函数式组件：返回就是 render 函数直接渲染即可
  if (isFunction(Comp)) {
    // 组件的 subTree 也是 vnode
    const vnode = instance.subTree = renderComponentRoot(instance)
    // 根据 vnode 生成 html 字符
    return renderVNode(vnode, instance)
  }
  else {
    // 普通的组件
    if (
      !instance.render
      || !Comp.ssrRender
      && !instance.ssrRender
      && isString(Comp.template)
    ) {
      // 如果 instance 中没有 render 或者 instance 和 Comp 没有 ssrRender，但是 Comp 中存在 template
      // TODO 调用 ssr 编译器编译
    }
    // 用户提供 render 函数
    else if (instance.render) {
      const vnode = instance.subTree = renderComponentRoot(instance)
      return renderVNode(vnode, instance)
    }
  }
}

// VNode 分发渲染
export function renderVNode(vnode: VNode, parentComponent = null) {
  const { type, shapeFlag, children } = vnode

  let ret = ''
  switch (type) {
    // 文本节点
    case Text:
      ret += `${escapeHtml(children)}` // 转义 HTML
      break
    // 注释节点
    case Comment:
      ret += children ? `<!--${children}-->` : '<!---->'
      break
    // Fragment
    case Fragment:
      ret += `<!--[-->${renderVNodeChildren(children, parentComponent)}<!--]-->`
      break
    default:
      // 组件节点
      if (shapeFlag & ShapeFlags.COMPONENT) {
        ret += renderComponentVNode(vnode, parentComponent)
      }
      // 元素节点
      else if (shapeFlag & ShapeFlags.ELEMENT) {
        ret += renderElementVNode(vnode, parentComponent)
      }
  }

  return ret
}

// 子节点批量渲染
export function renderVNodeChildren(children: VNode[], parentComponent) {
  let ret = ''
  for (let i = 0; i < children.length; i++) {
    const child = normalizeVNode(children[i]) // 规范化子节点
    ret += renderVNode(child, parentComponent) // 递归渲染
  }
  return ret
}
