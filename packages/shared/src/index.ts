export const extend = Object.assign

export const isObject = (value): value is Record<any, any> => typeof value === 'object' && value !== null

// 判断是否值是否改变
// 使用 === 进行判断会不严格：当 newValue 和 oldValue 都为 NaN 时，为 false 。 eg: NaN === NaN => false ; +0 === -0 => false
// 使用 Object.is 进行判断会更严格。 eg: Object.is(NaN, NaN) => true ; Object.is(+0, -0) => true
export const hasChanged = (newValue: unknown, oldValue: unknown) => !Object.is(newValue, oldValue)
