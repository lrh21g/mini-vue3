import { makeMap } from './makeMap'

// 特殊布尔值属性
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`
export const isSpecialBooleanAttr: (key: string) => boolean
/* @__PURE__ */ = makeMap(specialBooleanAttrs)

// 检查给定的 value 是否是一个布尔属性值
export function includeBooleanAttr(value: unknown): boolean {
  return !!value || value === ''
}
