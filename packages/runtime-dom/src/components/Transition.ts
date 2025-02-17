import type {
  TransitionHooks,
  TransitionProps,
  VNode,
} from '@mini-vue3/runtime-core'
import { toRaw } from '@mini-vue3/reactivity'
import {
  Comment,
  Fragment,
  isKeepAlive,
} from '@mini-vue3/runtime-core'

export const vtcKey: unique symbol = Symbol('_vtc')

// 对 HTMLElement 进行扩展，表示具有过渡效果的 HTML 元素
export interface ElementWithTransition extends HTMLElement {
  // [vtcKey] 可选属性，用于存储临时的过渡类。使用 Symbol('_vtc') 定义，是唯一的，不会与其他属性冲突
  // Set<string> 用于存储一组字符串，表示过渡期间临时添加的类名。使用 Set 集合，确保每个过渡类名不会重复添加
  [vtcKey]?: Set<string>
}

// 处理被 <KeepAlive> 包裹的组件，确保过渡作用于实际内容而非缓存容器
function getKeepAliveChild(vnode: VNode): VNode | undefined {
  return isKeepAlive(vnode)
    ? vnode.children
      ? ((vnode.children)[0] as VNode)
      : undefined
    : vnode
}

// 规范化子节点结构
export function getTransitionRawChildren(
  children: VNode[],
  keepComment: boolean = false,
): VNode[] {
  let ret: VNode[] = []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // 处理Fragment组件
    if (child.type === Fragment) {
      // 递归展开子节点
      ret = ret.concat(
        getTransitionRawChildren(child.children as VNode[], keepComment),
      )
    }
    // 过滤注释节点
    else if (keepComment || child.type !== Comment) {
      ret.push(child)
    }
  }

  return ret
}

// 过渡钩子
const hook: TransitionHooks = {
  beforeEnter(el) {
    // 初始状态

    el.classList.add('enter-from')
    el.classList.add('enter-active') // 激活 transform 过度
  },
  enter(el) {
    // 下一帧开始过渡
    nextFrame(() => {
      el.classList.remove('enter-from')
      el.classList.add('enter-to') // 激活过渡效果

      // 过度完成后监听，删除 class 类 enter-active 和 enter-to
      el.addEventListener(
        'transitionend',
        () => {
          el.classList.remove('enter-active')
          el.classList.remove('enter-to')
        },
      )
    })
  },
  leave(el, remove) {
    // 卸载的初始阶段：添加卸载前的 class
    el.classList.add('leave-from')
    el.classList.add('leave-active')

    // 强制重排确保样式生效
    // eslint-disable-next-line ts/no-unused-expressions
    document.body.offsetHeight

    // 下一帧执行过度
    nextFrame(() => {
      // 先删除 leave-from,添加 leave-to
      el.classList.remove('leave-from')
      el.classList.add('leave-to')

      // 监听过度完成，删除过度的样式，最后删除 el
      el.addEventListener('transitionend', () => {
        el.classList.remove('leave-active')
        el.classList.remove('leave-to')

        remove()
      })
    })
  },
}

// 下一帧执行
function nextFrame(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

// Transition 组件定义
export const Transition = {
  name: 'transition',
  setup(props: TransitionProps, { slots }) {
    return () => {
      if (!slots.default) {
        return null
      }

      // 处理子节点结构
      const children = getTransitionRawChildren(slots.default())
      // 多子节点不处理
      if (children.length > 1) {
        return children
      }

      const child = children[0]
      // 处理 KeepAlive
      const innerVNode = getKeepAliveChild(child)
      const rawProps = toRaw(props) as TransitionProps
      const { mode } = rawProps

      // 绑定过渡钩子
      if (!mode || mode === 'default') {
        innerVNode!.transition = hook
      }

      return innerVNode
    }
  },
}
