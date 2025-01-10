// 创建一个映射表，并返回一个用于检查 key 是否在映射表中的函数
// 注：对该函数的所有调用都必须以 /*#__PURE__*/ 开头，否则 Rollup 将不能正确地树摇掉这些调用。
export function makeMap(str: string): (key: string) => boolean {
  const map = Object.create(null)
  for (const key of str.split(',')) map[key] = 1
  return val => val in map
}
