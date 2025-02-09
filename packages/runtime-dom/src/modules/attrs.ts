import type { ComponentInternalInstance } from '@mini-vue3/runtime-core'
import { includeBooleanAttr, isSpecialBooleanAttr, isSymbol } from '@mini-vue3/shared'

export const xlinkNS = 'http://www.w3.org/1999/xlink'

/**
 * 更新属性
 * 根据属性类型和其值的变化，对元素的属性进行添加、更新或删除操作。
 * @param {Element} el 目标 DOM 元素
 * @param {string} key 属性名
 * @param {any} value 属性值
 * @param {boolean} isSVG 是否为 SVG 元素
 * @param {ComponentInternalInstance | null} [instance] Vue 组件实例对象，用于兼容性处理（可选）
 * @param {boolean} isBoolean 是否为布尔属性（默认为根据 key 判断），布尔属性在 DOM 中通常仅需设置为 "" 或移除
 */
export function patchAttr(
  el: Element,
  key: string,
  value: any,
  isSVG: boolean,
  instance?: ComponentInternalInstance | null,
  isBoolean: boolean = isSpecialBooleanAttr(key),
) {
  if (isSVG && key.startsWith('xlink:')) {
    // 处理 SVG 元素

    if (value == null) {
      el.removeAttributeNS(xlinkNS, key.slice(6, key.length))
    }
    else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  }
  else {
    if (value == null || (isBoolean && !includeBooleanAttr(value))) {
      // 如果【value 为 null】 或 【key 是布尔属性值，且 value 为 false（由 includeBooleanAttr 判断）】，则删除该属性

      el.removeAttribute(key)
    }
    else {
      el.setAttribute(
        key,
        // 如果属性值是布尔值，则设置为空字符串，否则转换为字符串
        isBoolean ? '' : isSymbol(value) ? String(value) : value,
      )
    }
  }
}
