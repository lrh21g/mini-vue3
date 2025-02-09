export const vtcKey: unique symbol = Symbol('_vtc')

// 对 HTMLElement 进行扩展，表示具有过渡效果的 HTML 元素
export interface ElementWithTransition extends HTMLElement {
  // [vtcKey] 可选属性，用于存储临时的过渡类。使用 Symbol('_vtc') 定义，是唯一的，不会与其他属性冲突
  // Set<string> 用于存储一组字符串，表示过渡期间临时添加的类名。使用 Set 集合，确保每个过渡类名不会重复添加
  [vtcKey]?: Set<string>
}

export const Transition = {}
