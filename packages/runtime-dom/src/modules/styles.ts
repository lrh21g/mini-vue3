import type { VShowElement } from '../directives/VShow'
import { camelize, capitalize, hyphenate, isArray, isString } from '@mini-vue3/shared'
import { vShowHidden, vShowOriginalDisplay } from '../directives/VShow'
import { CSS_VAR_TEXT } from '../helpers/useCssVars'

type Style = string | Record<string, string | string[]> | null

// eslint-disable-next-line regexp/no-unused-capturing-group
const displayRE = /(^|;)\s*display\s*:/

/**
 * 更新 DOM 设置元素的样式
 * @param {Element} el 目标 DOM 元素
 * @param {Style} prev 更新前的样式
 * @param {Style} next 更新后的样式
 */
export function patchStyle(
  el: Element,
  prev: Style,
  next: Style,
) {
  // 获取元素的 style 属性
  const style = (el as HTMLElement).style
  const isCssString = isString(next)
  // 用于标记当前样式是否控制了 display 属性
  let hasControlledDisplay = false

  if (next && !isCssString) {
    // 如果更新后的样式 next 是不是字符串，即为对象

    if (prev) {
      // 更新前的样式 prev存在，则进行清空

      if (!isString(prev)) {
        for (const key in prev) {
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      }
      else {
        for (const prevStyle of prev.split(';')) {
          const key = prevStyle.slice(0, prevStyle.indexOf(':')).trim()
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      }
    }

    // 遍历更新后的样式对象 next ，设置样式。如果样式是 display，则标记 hasControlledDisplay 为 true
    for (const key in next) {
      if (key === 'display') {
        hasControlledDisplay = true
      }
      setStyle(style, key, next[key])
    }
  }
  else {
    if (isCssString) {
      // 如果更新后的样式 next 是字符串
      if (prev !== next) {
        const cssVarText = (style as any)[CSS_VAR_TEXT]
        if (cssVarText) {
          ;(next as string) += `;${cssVarText}`
        }
        style.cssText = next as string
        // 判断是否包含 display 属性，如果存在，则标记 hasControlledDisplay 为 true
        hasControlledDisplay = displayRE.test(next)
      }
    }
    else if (prev) {
      // 如果更新前的样式 prev 存在，且更新后的样式 next 是 null，则移除元素的 style 属性
      el.removeAttribute('style')
    }
  }

  // 处理 v-show 相关样式：元素上存在 vShowOriginalDisplay 属性（即该元素使用了 v-show 指令）
  // > 如果 hasControlledDisplay 为 true，则将 el[vShowOriginalDisplay] 设置为元素当前的 display 样式，否则设置为空字符串。
  // > 如果元素的 v-show 设置为 true，则将 style.display 设置为 'none'，确保 v-show 的隐藏状态优先于其他样式
  if (vShowOriginalDisplay in el) {
    el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : ''
    if ((el as VShowElement)[vShowHidden]) {
      style.display = 'none'
    }
  }
}

const importantRE = /\s*!important$/
// 设置样式
function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[],
) {
  if (isArray(val)) {
    val.forEach(v => setStyle(style, name, v))
  }
  else {
    if (val == null)
      val = ''
    if (name.startsWith('--')) {
      // CSSStyleDeclaration.setProperty() 方法：为一个声明了 CSS 样式的对象设置一个新的值
      style.setProperty(name, val)
    }
    else {
      const prefixed = autoPrefix(style, name)

      // 如果 val 包含 !important，则使用 setProperty 来强制应用该样式，否则直接赋值给 style 对象。
      if (importantRE.test(val)) {
        style.setProperty(
          hyphenate(prefixed),
          val.replace(importantRE, ''),
          'important',
        )
      }
      else {
        style[prefixed as any] = val
      }
    }
  }
}

const prefixes = ['Webkit', 'Moz', 'ms']
const prefixCache: Record<string, string> = {}
// 自动添加 CSS 前缀
function autoPrefix(style: CSSStyleDeclaration, rawName: string): string {
  const cached = prefixCache[rawName]
  if (cached) {
    return cached
  }
  // 将连字符命名转化为驼峰式命名。例如： camel-case 会变成 camelCase
  let name = camelize(rawName)
  if (name !== 'filter' && name in style) {
    return (prefixCache[rawName] = name)
  }
  // 将字符串首字母大写的函数
  name = capitalize(name)
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name
    if (prefixed in style) {
      return (prefixCache[rawName] = prefixed)
    }
  }
  return rawName
}
