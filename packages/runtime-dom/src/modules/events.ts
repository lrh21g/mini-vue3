import { hyphenate, isArray } from '@mini-vue3/shared'

interface Invoker extends EventListener {
  value: EventValue
  attached: number
}

// eslint-disable-next-line ts/no-unsafe-function-type
type EventValue = Function | Function[]

const veiKey: unique symbol = Symbol('_vei')

/**
 * 更新 DOM 元素的事件监听器
 * 据事件名称和新的事件值（nextValue）来决定是为事件添加监听器，还是更新现有监听器，或者移除监听器。
 * @param {Element & { [veiKey]?: Record<string, Invoker | undefined> }} el 目标 DOM 元素
 * @param {string} rawName 事件名
 * @param {EventValue | unknown} nextValue 事件值
 */
export function patchEvent(
  el: Element & { [veiKey]?: Record<string, Invoker | undefined> },
  rawName: string,
  nextValue: EventValue | unknown,
) {
  // 存储当前元素上所有事件监听器的 Invoker ，保存在 el[veiKey] 上
  const invokers = el[veiKey] || (el[veiKey] = {})
  const existingInvoker = invokers[rawName]

  if (nextValue && existingInvoker) {
    // 已存在对应的监听器，进行更新
    existingInvoker.value = nextValue as EventValue
  }
  else {
    const [name, options] = parseName(rawName)
    if (nextValue) {
      // 添加事件监听器
      // 调用 createInvoker 创建新的 Invoker，并使用 addEventListener 为元素添加该事件的监听器
      const invoker = (invokers[rawName] = createInvoker((nextValue as EventValue)))
      el.addEventListener(name, invoker, options)
    }
    else if (existingInvoker) {
      // 移除事件监听器
      // nextValue 为 null 或 undefined，且 existingInvoker 存在，则移除该事件的监听器。
      el.removeEventListener(name, existingInvoker, options)
      invokers[rawName] = undefined
    }
  }
}

// 选项修饰符匹配正则表达式：以 Once、Passive、Capture 结尾的字符串，用于处理事件监听器的选项（如 once、capture、passive）。
const optionsModifierRE = /(?:Once|Passive|Capture)$/
// 用于解析事件名
// 返回 [name, options] ： name 为标准化后的事件名，options 为事件修饰符（如 once、capture、passive）
function parseName(name: string): [string, EventListenerOptions | undefined] {
  // 匹配以 Once、Passive、Capture 结尾的事件名，提取并存储在 options 对象中
  let options: EventListenerOptions | undefined
  if (optionsModifierRE.test(name)) {
    options = {}
    let m
    // eslint-disable-next-line no-cond-assign
    while ((m = name.match(optionsModifierRE))) {
      name = name.slice(0, name.length - m[0].length)
      ;(options as any)[m[0].toLowerCase()] = true
    }
  }

  // 事件名通常以 on 开头（例如 onClick），因此需要去掉 on 前缀，并将其转换为短横线分隔的小写形式（例如 onClick 转换为 click）
  const event = name[2] === ':' ? name.slice(3) : hyphenate(name.slice(2))
  return [event, options]
}

// 缓存变量，存储上次获取的时间戳，避免重复调用 Date.now()，提高性能。
let cachedNow: number = 0
const p = /* @__PURE__ */ Promise.resolve()
// 获取当前的时间戳，并通过一个 Promise 确保时间戳的获取是尽可能精准和高效的
function getNow() {
  // p.then() 确保时间戳更新是通过异步微任务进行的
  return cachedNow || (p.then(() => (cachedNow = 0)), (cachedNow = Date.now()))
}

// 用于创建事件的实际处理器（Invoker）
//
function createInvoker(initialValue: EventValue) {
  // invoker 函数在事件触发时被调用
  // 该函数会检查事件的时间戳，避免在浏览器的微任务队列中发生重复执行的情况。
  const invoker: Invoker = (e: Event & { _vts?: number }) => {
    if (!e._vts) {
      e._vts = Date.now()
    }
    else if (e._vts <= invoker.attached) {
      return
    }
    isArray(invoker.value) ? invoker.value.map(fn => fn(e)) : invoker.value(e)
  }
  // 存储实际的事件处理函数，可能是一个函数或函数数组
  invoker.value = initialValue
  // 记录了事件处理器附加到元素上的时间戳，用于防止老的事件处理器触发
  invoker.attached = getNow()
  return invoker
}
