import type { RendererOptions } from '@mini-vue3/runtime-core'
import type {
  TrustedHTML,
  TrustedTypePolicy,
  TrustedTypesWindow,
} from 'trusted-types/lib'

let policy: Pick<TrustedTypePolicy, 'name' | 'createHTML'> | undefined

// trustedTypes 是浏览器中用于创建受信任类型的全局对象
const tt
  = typeof window !== 'undefined'
  && (window as unknown as TrustedTypesWindow).trustedTypes

// 如果浏览器支持 Trusted Types，并且成功获取了 trustedTypes，则创建一个名为 vue 的 Trusted Types 策略
if (tt) {
  policy = /* @__PURE__ */ tt.createPolicy('vue', {
    createHTML: val => val,
  })
}

// 接受一个字符串 value 并返回一个 TrustedHTML 类型的值（如果支持 Trusted Types）或者原始的字符串
// > 如果 policy 存在（即浏览器支持 Trusted Types），则使用 policy.createHTML(val) 创建一个受信任的 HTML 类型。
// > 如果 policy 不存在，则直接返回原始字符串 val，这意味着当前环境不支持 Trusted Types，直接使用原始的 HTML 字符串。
export const unsafeToTrustedHTML: (value: string) => TrustedHTML | string
  = policy ? val => policy.createHTML(val) : val => val

// SVG 和 MathML 的命名空间 URI，用于标识这两种特殊类型的 XML 内容
export const svgNS = 'http://www.w3.org/2000/svg'
export const mathmlNS = 'http://www.w3.org/1998/Math/MathML'

// 对 document 对象的引用，确保在浏览器环境下存在 document
const doc = (typeof document !== 'undefined' ? document : null) as Document
// 用于临时存放 HTML 内容的 template 元素，它将用来处理静态内容的插入
// const templateContainer = doc && /* @__PURE__ */ doc.createElement('template')

export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  // 将 child 节点插入 parent 中 anchor 节点之前
  // 当 anchor 为 null 时，相当于 parent.appendChild(child)
  // e.g. 元素 [a, b, c, d, e]
  // insert(a, parentNode, e) => [b, c, d, a, e]
  // insert(a, parentNode) => [b, c, d, e, a]
  // insert(h, parentNode) => [a, b, c, d, e, h]
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },

  // 将 child 从其父节点中移除
  remove: (child) => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  // 创建一个新的 DOM 元素
  createElement: (tag, namespace, is, props): Element => {
    const el
      = namespace === 'svg'
        ? doc.createElementNS(svgNS, tag)
        : namespace === 'mathml'
          ? doc.createElementNS(mathmlNS, tag)
          : is
            // is 是用 customElements.define() 方法定义过的一个自定义元素的标签名。
            ? doc.createElement(tag, { is })
            : doc.createElement(tag)

    // 如果 tag 是 select 且 props.multiple 存在，则为 select 元素设置 multiple 属性
    if (tag === 'select' && props && props.multiple != null) {
      ;(el as HTMLSelectElement).setAttribute('multiple', props.multiple)
    }

    return el
  },

  // 创建一个文本节点
  createText: text => doc.createTextNode(text),

  // 创建一个注释节点
  createComment: text => doc.createComment(text),

  // 设置文本节点的值
  setText: (node, text) => {
    node.nodeValue = text
  },

  // 设置元素节点的文本内容
  setElementText: (el, text) => {
    el.textContent = text
  },

  // 返回节点的父节点
  parentNode: node => node.parentNode as Element | null,

  // 返回节点的下一个兄弟节点
  nextSibling: node => node.nextSibling,

  // 返回与指定选择器匹配的第一个元素
  querySelector: selector => doc.querySelector(selector),

  // 容器的第一个节点
  firstChild: container => container.firstChild,

  // 为元素 el 设置一个作用域 ID，通常用于支持 Scoped CSS 的场景
  // setScopeId(el, id) {
  //   el.setAttribute(id, '')
  // },

  // // 用于插入静态内容。它会将指定的 content 插入到 parent 节点的 anchor 前。
  // // > 如果 start 和 end 存在且指向的是有效的节点，它会利用缓存的路径直接插入内容。
  // // > 如果没有缓存路径，会将内容通过 template 解析并插入到指定的容器中。
  // // > 对于 svg 或 mathml，它会移除外部的 <svg> 或 <math> 标签。
  // insertStaticContent(content, parent, anchor, namespace, start, end) {
  //   // <parent> before | first ... last | anchor </parent>
  //   const before = anchor ? anchor.previousSibling : parent.lastChild
  //   // #5308 can only take cached path if:
  //   // - has a single root node
  //   // - nextSibling info is still available
  //   if (start && (start === end || start.nextSibling)) {
  //     // cached
  //     while (true) {
  //       parent.insertBefore(start!.cloneNode(true), anchor)
  //       // eslint-disable-next-line no-cond-assign
  //       if (start === end || !(start = start!.nextSibling))
  //         break
  //     }
  //   }
  //   else {
  //     // fresh insert
  //     templateContainer.innerHTML = unsafeToTrustedHTML(
  //       namespace === 'svg'
  //         ? `<svg>${content}</svg>`
  //         : namespace === 'mathml'
  //           ? `<math>${content}</math>`
  //           : content,
  //     ) as string

  //     const template = templateContainer.content
  //     if (namespace === 'svg' || namespace === 'mathml') {
  //       // remove outer svg/math wrapper
  //       const wrapper = template.firstChild!
  //       while (wrapper.firstChild) {
  //         template.appendChild(wrapper.firstChild)
  //       }
  //       template.removeChild(wrapper)
  //     }
  //     parent.insertBefore(template, anchor)
  //   }
  //   return [
  //     // first
  //     before ? before.nextSibling! : parent.firstChild!,
  //     // last
  //     anchor ? anchor.previousSibling! : parent.lastChild!,
  //   ]
  // },
}
