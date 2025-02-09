import { type ElementWithTransition, vtcKey } from '../components/Transition'

/**
 * 更新 DOM 元素的 class 属性
 * 处理了普通 HTML 元素和 SVG 元素的类名更新，同时还考虑到了过渡类（Transition Classes）
 * @param {Element} el 目标 DOM 元素
 * @param {string | null} value 设置 class 类名
 * @param {boolean} isSVG 是否为 SVG 元素
 */
export function patchClass(
  el: Element,
  value: string | null,
  isSVG: boolean,
) {
  // 获取当前元素的过渡类名，通常是用于动画或过渡效果的临时类
  const transitionClasses = (el as ElementWithTransition)[vtcKey]
  // 如果元素有过渡类（transitionClasses），则将它们与传入的 value 类名合并
  if (transitionClasses) {
    // 如果 value 存在，将其与过渡类一同合并并转换为一个字符串。否则，只使用过渡类
    value = (
      value ? [value, ...transitionClasses] : [...transitionClasses]
    ).join(' ')
  }

  if (value == null) {
    el.removeAttribute('class')
  }
  else if (isSVG) {
    el.setAttribute('class', value)
  }
  else {
    el.className = value
  }
}
