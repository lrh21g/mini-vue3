/* eslint-disable ts/no-use-before-define */
import { ReactiveFlags } from '@mini-vue3/reactivity'
import {
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
  isString,
  isSymbol,
  objectToString,
} from './general'

function isRef(val: any): val is { value: unknown } {
  return !!(val && val[ReactiveFlags.IS_REF] === true)
}

export function toDisplayString(val: unknown): string {
  return isString(val)
    ? val // 基础字符串直接返回
    : val == null
      ? '' // null/undefined 返回空字符串
      // 处理数组/特殊对象
      : isArray(val) || (isObject(val) && (val.toString === objectToString || !isFunction(val.toString)))
        // 处理 Vue 的 ref 对象
        ? isRef(val)
          ? toDisplayString(val.value)
          : JSON.stringify(val, replacer, 2) // 带格式的序列化
        : String(val) // 其他类型直接转换
}

function replacer(_key: string, val: unknown): any {
  // 处理Vue ref对象
  if (isRef(val)) {
    return replacer(_key, val.value) // 递归解包
  }
  // 处理 Map 类型
  else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce(
        (entries, [key, val], i) => {
          entries[`${stringifySymbol(key, i)} =>`] = val
          return entries
        },
        {} as Record<string, any>,
      ),
    }
  }
  // 处理 Set 类型
  else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()].map(v => stringifySymbol(v)),
    }
  }
  // 处理 Symbol 类型
  else if (isSymbol(val)) {
    return stringifySymbol(val)
  }
  // 处理非普通对象（如 Date/自定义类实例）
  else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    // native elements
    return String(val) // 直接调用 toString()
  }
  return val // 其他类型保持原样
}

const stringifySymbol = (v: unknown, i: number | string = ''): any => isSymbol(v) ? `Symbol(${(v as any).description ?? i})` : v
