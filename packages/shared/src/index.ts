export const extend = Object.assign

export const isObject = (value): value is Record<any, any> => typeof value === 'object' && value !== null
