export const objectToString: typeof Object.prototype.toString = Object.prototype.toString
export const toTypeString = (value: unknown): string => objectToString.call(value)
export function toRawType(value: unknown): string {
  // 从字符串 "[object RawType]" 中提取 "RawType"
  return toTypeString(value).slice(8, -1)
}

export const extend: typeof Object.assign = Object.assign

export const isArray: typeof Array.isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === '[object Map]'
export const isSet = (val: unknown): val is Set<any> => toTypeString(val) === '[object Set]'
export const isDate = (val: unknown): val is Date => toTypeString(val) === '[object Date]'
export const isRegExp = (val: unknown): val is RegExp => toTypeString(val) === '[object RegExp]'
export const isFunction = (val: unknown): val is () => void => typeof val === 'function'

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> => val !== null && typeof val === 'object'
export const isPlainObject = (val: unknown): val is object => toTypeString(val) === '[object Object]'
export function isPromise<T = any>(val: unknown): val is Promise<T> {
  return (
    (isObject(val) || isFunction(val))
    && isFunction((val as any).then)
    && isFunction((val as any).catch)
  )
}
export function isIntegerKey(key: unknown): boolean {
  return isString(key)
    && key !== 'NaN'
    && key[0] !== '-'
    && `${Number.parseInt(key, 10)}` === key
}

// 判断是否值是否改变
// 使用 === 进行判断会不严格：当 newValue 和 oldValue 都为 NaN 时，为 false 。 eg: NaN === NaN => false ; +0 === -0 => false
// 使用 Object.is 进行判断会更严格。 eg: Object.is(NaN, NaN) => true ; Object.is(+0, -0) => true
export const hasChanged = (newValue: unknown, oldValue: unknown) => !Object.is(newValue, oldValue)
