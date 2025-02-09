import { shallowReactive } from '@mini-vue3/reactivity'

/**
 * 从原始 rawProps 中解析出 props 和未声明的 attrs
 * @param propsOptions 组件声明的 props
 * @param rawProps 未被声明的 props 的属性，通常会被附加到组件根元素上
 */
export function resolveProps(propsOptions, rawProps) {
  const props = {} // 存放声明的 props
  const attrs = {} // 存放非声明的属性
  // 获取组件声明的 props 列表
  const options = propsOptions && Object.keys(propsOptions)

  if (rawProps) {
    // 遍历 rawProps 中的属性，判断 key 是否存在于 propsOptions 中，如果存在则将其添加到 props 中，否则添加到 attrs 中
    for (const key in rawProps) {
      const value = rawProps[key]
      if (options.includes(key)) {
        props[key] = value
      }
      else {
        attrs[key] = value
      }
    }
  }
  return { props, attrs }
}

/**
 * 初始化组件实例的 props 和 attrs，并根据组件的状态性和运行环境决定是否为 props 创建响应式代理。
 * @param instance 当前组件实例
 * @param rawProps 传入的原始 props
 * @param isStateful 是否是有状态组件（Stateful Component）
 * @param isSSR 是否是服务端渲染环境（SSR）
 */
export function initProps(instance, rawProps, isStateful, isSSR = false) {
  // 解析出 props 和 attrs
  const { props, attrs } = resolveProps(instance.propsOptions, rawProps)

  if (isStateful) {
    // 有状态组件
    // 如果是 SSR 环境，则不需要响应性处理
    instance.props = isSSR ? props : shallowReactive(props)
  }
  else {
    // 无状态组件（函数式组件）
    // 如果组件内部未定义 props 选项，则使用 attrs ；定义了 props 选项，则使用 props
    if (!instance.type.props) {
      instance.props = attrs
    }
    else {
      instance.props = props
    }
  }
  instance.attrs = attrs
}
