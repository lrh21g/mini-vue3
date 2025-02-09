import { reactive } from '@mini-vue3/reactivity'

export function applyOptions(instance) {
  const { beforeCreate, created } = instance.type
  const publicThis = instance.proxy

  // 执行 beforeCreate 生命周期
  beforeCreate && beforeCreate.call(publicThis)

  // 初始化 optionsApi ： 用于为 options 创建 this
  // TODO injectOptions

  // TODO methods

  // dataOptions
  instance.data = reactive(instance.data)

  // TODO computedOptions

  // TODO watchOptions

  // TODO provideOptions

  // 执行 created 生命周期
  created && created.call(publicThis)

  // TODO 为选项生命周期注册 this

  // TODO expose 处理

  // TODO components

  // TODO directives
}
