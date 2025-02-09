import { includeBooleanAttr } from '@mini-vue3/shared'
import { unsafeToTrustedHTML } from '../nodeOps'

/**
 * 更新 DOM 元素的属性
 * @param {any} el 目标 DOM 元素
 * @param {string} key 属性名
 * @param {any} value 属性值
 * @param {string} [attrName] 可选，替代属性名
 */
export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  attrName?: string,
): void {
  // 处理 innerHTML 和 textContent
  if (key === 'innerHTML' || key === 'textContent') {
    if (value != null) {
      el[key] = key === 'innerHTML' ? unsafeToTrustedHTML(value) : value
    }
    return
  }

  const tag = el.tagName

  if (key === 'value'
    && tag !== 'PROGRESS'
    // 非自定义元素，自定义元素可以使用内部的 _value
    && !tag.includes('-')
  ) {
    // <options> 的值会回退到其文本内容，所以需要与其属性值进行比较
    const oldValue = tag === 'OPTION' ? el.getAttribute('value') || '' : el.value
    // 对于 value 为 null ，应该设置为空字符，但 checkbox 应该设置为 'on'
    const newValue
      = value == null
        ? el.type === 'checkbox'
          ? 'on'
          : ''
        : String(value)
    if (oldValue !== newValue || !('_value' in el)) {
      el.value = newValue
    }
    // 如果 value 为 null ，则移除属性
    if (value == null) {
      el.removeAttribute(key)
    }
    el._value = value
    return
  }

  let needRemove = false
  // 处理 value 为 null 或空字符串时
  if (value === '' || value == null) {
    const type = typeof el[key]
    if (type === 'boolean') {
      // 布尔值类型的属性（例如 disabled、checked 等），使用 includeBooleanAttr 进行处理
      // e.g. <button disabled></button> <button disabled=""></button>
      value = includeBooleanAttr(value)
    }
    else if (value == null && type === 'string') {
      // 对于字符串类型的属性，赋值为空字符串，并标记需要移除该属性
      // e.g. <div :id="null">
      value = ''
      needRemove = true
    }
    else if (type === 'number') {
      // 对于数字类型的属性，赋值为 0 ，并标记需要移除
      // e.g. <img :width="null">
      value = 0
      needRemove = true
    }
  }

  try {
    // 更新属性
    el[key] = value
  }
  catch (e) {
    console.warn('patchDOMProp e', e)
  }
  // 如果需移除该属性，则进行移除
  needRemove && el.removeAttribute(attrName || key)
}
