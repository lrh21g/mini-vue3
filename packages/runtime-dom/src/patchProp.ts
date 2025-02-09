import { isFunction, isModelListener, isOn, isString } from '@mini-vue3/shared'
import { patchAttr } from './modules/attrs'
import { patchClass } from './modules/class'
import { patchEvent } from './modules/events'
import { patchDOMProp } from './modules/props'
import { patchStyle } from './modules/styles'

function isNativeOn(key: string) {
  return key.charCodeAt(0) === 111 /* o */
    && key.charCodeAt(1) === 110 /* n */
    // 小写字母 a-z
    && key.charCodeAt(2) > 96
    && key.charCodeAt(2) < 123
}

export function patchProp(
  el,
  key,
  prevValue,
  nextValue,
  namespace,
) {
  const isSVG = namespace === 'svg'
  if (key === 'class') {
    patchClass(el, nextValue, isSVG)
  }
  else if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  }
  else if (isOn(key)) {
    if (!isModelListener(key)) {
      patchEvent(el, key, prevValue)
    }
  }
  else if (
    key[0] === '.'
      // eslint-disable-next-line no-cond-assign
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        // eslint-disable-next-line no-cond-assign
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, nextValue, isSVG)
  ) {
    patchDOMProp(el, key, nextValue)

    if (
      !el.tagName.includes('-')
      && (key === 'value' || key === 'checked' || key === 'selected')
    ) {
      patchAttr(el, key, nextValue, isSVG)
    }
  }
  else {
    // 带有 :true-value 和 :false-value 的 <input v-model type=“checkbox”> 的特殊情况：
    // 将值存储为 dom 属性，因为非字符串值将被字符串化
    if (key === 'true-value') {
      ;(el as any)._trueValue = nextValue
    }
    else if (key === 'false-value') {
      ;(el as any)._falseValue = nextValue
    }
    patchAttr(el, key, nextValue, isSVG)
  }
}

function shouldSetAsProp(
  el: Element,
  key: string,
  value: unknown,
  isSVG: boolean,
) {
  if (isSVG) {
    // SVG 元素的属性大多数可以作为 DOM 属性设置，处了 'innerHTML' 和 'textContent'
    if (key === 'innerHTML' || key === 'textContent') {
      return true
    }
    // 或者是元素的 DOM 内嵌事件
    if (key in el && isNativeOn(key) && isFunction(value)) {
      return true
    }
    return false
  }

  // 这些都是枚举的属性，但其对应的 DOM 属性实际上是布尔值
  // 这导致在设置时使用字符串 "false" 值会将其强制为 "true"，因此需要始终将其视为属性
  // 注意，`contentEditable` 不存在这个问题，它的 DOM 属性是枚举字符串值
  if (key === 'spellcheck' || key === 'draggable' || key === 'translate') {
    return false
  }

  // 表单元素上的 form 属性是只读的，必须作为属性设置
  if (key === 'form') {
    return false
  }

  // <input list> 必须作为属性设置
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }

  // <textarea type> 必须作为属性设置
  if (key === 'type' && el.tagName === 'TEXTAREA') {
    return false
  }

  // 嵌入标签的宽度或高度，必须作为属性设置
  if (key === 'width' || key === 'height') {
    const tag = el.tagName
    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'SOURCE') {
      return false
    }
  }

  // 带字符串值的 DOM 内嵌事件，必须作为属性设置
  if (isNativeOn(key) && isString(value)) {
    return false
  }

  return key in el
}
