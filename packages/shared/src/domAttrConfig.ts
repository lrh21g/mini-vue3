/* eslint-disable regexp/control-character-escape */
/* eslint-disable unicorn/escape-case */
/* eslint-disable no-control-regex */
import { makeMap } from './makeMap'

// 特殊布尔值属性
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`
export const isSpecialBooleanAttr: (key: string) => boolean
/* @__PURE__ */ = makeMap(specialBooleanAttrs)

// 检查给定的 value 是否是一个布尔属性值
export function includeBooleanAttr(value: unknown): boolean {
  return !!value || value === ''
}

// 布尔属性快速检测
export const isBooleanAttr: (key: string) => boolean = /* @__PURE__ */ makeMap(
  `${specialBooleanAttrs}`
  + `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,`
  + `inert,loop,open,required,reversed,scoped,seamless,`
  + `checked,muted,multiple,selected`,
)

// 不安全字符正则表达式
// 语法符号：>（标签结束）、/（自闭合标签）、=（属性赋值）、" 和 '（属性值包裹符）。
// 空白字符：\u0009 - 水平制表符（Tab）、 \u000a - 换行符（LF）、 \u000c - 换页符（FF）、 \u0020 - 空格。
const unsafeAttrCharRE = /[>/="'\u0009\u000a\u000c\u0020]/
const attrValidationCache: Record<string, boolean> = {}
// 安全属性校验
export function isSSRSafeAttrName(name: string): boolean {
  // 安全检测属性存在性，避免原型链污染
  if (Object.prototype.hasOwnProperty.call(attrValidationCache, name)) {
    return attrValidationCache[name]
  }
  const isUnsafe = unsafeAttrCharRE.test(name)
  if (isUnsafe) {
    console.error(`unsafe attribute name: ${name}`)
  }
  return (attrValidationCache[name] = !isUnsafe)
}
