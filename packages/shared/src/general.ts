export function NOOP(): void {}

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

const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(val: object, key: string | symbol): key is keyof typeof val {
  return hasOwnProperty.call(val, key)
}

export function def(obj: object, key: string | symbol, value: any, writable = false): void {
  Object.defineProperty(
    obj,
    key,
    {
      // 是否可配置。默认值为 false
      // 当设置为 false 时，该属性的类型不能在数据属性和访问器属性（由 getter/setter 函数对描述的属性）之间更改，且不可被删除，且其描述符的其他属性也不能被修改。
      // 如果是一个可写的数据描述符，则 value 可以被更改， writable 可以更改为 false 。
      // eg : 使用 delete obj[key] 来删除该属性，或者修改它的 writable 或 enumerable 特性
      configurable: true,
      // 是否可枚举。默认值为 false
      // 当且仅当该属性在对应对象的属性枚举中出现时，值为 true
      // eg : 设置为 false，则不会出现在 for...in 循环或 Object.keys() 等方法的结果中。这个特性可以用于将一些内部属性隐藏起来，避免被列举出来。
      enumerable: false,
      // 是否可写。默认值为 false。
      // 如果与属性相关联的值可以使用赋值运算符更改，则为 true
      writable,
      // 属性的值
      value,
    },
  )
}

// 接收一个函数 fn 作为参数，并返回一个新函数，通过缓存机制避免重复计算，提高性能
function cacheStringFunction<T extends (str: string) => string>(fn: T): T {
  // 创建一个没有集成 Object.prototype 的对象，避免潜在的属性冲突
  const cache: Record<string, string> = Object.create(null)
  // 返回新的函数
  // 缓存机制：如果缓存 cache 对象中，已经存在字符串 str 对应的缓存结果 hit ，则直接返回缓存中的值；否则调用原始函数 fn 进行转换，并将结果缓存在 cache 中
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as T
}

const camelizeRE = /-(\w)/g
// 将连字符命名转化为驼峰式命名。例如： camel-case 会变成 camelCase
// 将一个以连字符（-）分隔的字符串转换为驼峰式（camelCase）字符串
export const camelize: (str: string) => string = cacheStringFunction(
  (str: string): string => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
  },
)

// 正则表达式说明
// \B：匹配非单词边界（即，大写字母前面不能是空格或其他标点符号）
// ([A-Z])：捕获一个大写字母
const hyphenateRE = /\B([A-Z])/g
// 将驼峰式命名转换为连字符命名。例如： kebabCase 会变成 kebab-case
export const hyphenate: (str: string) => string = cacheStringFunction(
  (str: string) => str.replace(hyphenateRE, '-$1').toLowerCase(),
)

// 将字符串首字母大写的函数
export const capitalize: <T extends string>(str: T) => Capitalize<T>
  = cacheStringFunction(<T extends string>(str: T) => {
    return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>
  })

export function isOn(key: string): boolean {
  return key.charCodeAt(0) === 111 /* o */
    && key.charCodeAt(1) === 110 /* n */
    // 大写字母 A-Z
    && (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97)
}
export function isModelListener(key: string): key is `onUpdate:${string}` {
  return key.startsWith('onUpdate:')
}

// 接受一个函数数组（fns）和若干参数（arg），然后依次调用数组中的每个函数，并传递这些参数
export function invokeArrayFns(fns: Array<(...args: any[]) => void>, ...arg: any[]): void {
  for (let i = 0; i < fns.length; i++) {
    fns[i](...arg)
  }
}

// 将一个事件名（字符串）转换为事件处理函数的名称
// e.g. "click" => "onClick" ; "mousedown" => "onMousedown" ; "" => ""
export const toHandlerKey: <T extends string>(
  str: T,
) => T extends '' ? '' : `on${Capitalize<T>}` = cacheStringFunction(
  <T extends string>(str: T) => {
    const s = str ? `on${capitalize(str)}` : ``
    return s as T extends '' ? '' : `on${Capitalize<T>}`
  },
)
