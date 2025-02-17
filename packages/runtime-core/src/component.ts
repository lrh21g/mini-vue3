/* eslint-disable ts/no-unsafe-function-type */
import type { CompilerOptions } from '@mini-vue3/compiler-core'
import type { VNode } from './vnode'
import { enableTracking, pauseTracking, proxyRefs, shallowReadonly } from '@mini-vue3/reactivity'
import { isFunction, isObject, isPromise, NOOP, ShapeFlags } from '@mini-vue3/shared'
import { emit } from './componentEmits'
import { applyOptions } from './componentOptions'
import { initProps } from './componentProps'
import { PublicInstanceProxyHandler } from './componentPublicInstance'
import { initSlots, type InternalSlots } from './componentSlots'

export enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec',
  SERVER_PREFETCH = 'sp',
}

export interface RuntimeCompilerOptions {
  isCustomElement?: (tag: string) => boolean
  whitespace?: 'preserve' | 'condense'
  comments?: boolean
  delimiters?: [string, string]
}

export type Data = Record<string, unknown>

export type Component = ComponentOptions | FunctionalComponent

export type ComponentOptions = baseComponentOptions

export interface FunctionalComponent {
  (props: Data, ctx: Omit<SetupContext, 'expose'>): any
  props?: Data
  emits?: string[]
  displayName?: string
}

export interface baseComponentOptions {
  name?: string
  setup?: (this, props, ctx: SetupContext) => any
  render?: Function
  props?: Data
  template?: string | object
  ssrRender?: Function
  emits: string[]
  expose?: string[]
  components?: Record<string, Component>
  compilerOptions?: RuntimeCompilerOptions
}

export interface SetupContext {
  attrs: Data
  slots: any
  emit: any
  expose: (exposed) => any
}

export interface ComponentInternalInstance {
  type: any // 组件对象
  vnode: VNode | null // 组件对应的虚拟节点
  next: VNode | null // 更新组件时存储新的 VNode 。在组件更新过程中，next 会替换 vnode
  subTree: any // 表示组件渲染的子树，即组件模板的渲染结果
  parent: ComponentInternalInstance
  update: Function // 组件的更新函数。每当组件状态变化或 props 更新时，调用该函数重新渲染组件
  render: Function | null // 组件的渲染函数
  ssrRender?: Function | null // 表示服务端渲染时的渲染函数。如果组件支持 SSR，则该函数用于生成服务端的 HTML 内容。
  proxy: any // 组件实例的代理对象。通过 Proxy 实现，简化对组件数据和状态的访问
  exposed: object // 通过 expose 方法显式暴露给外部的对象。用于暴露组件的内部方法或属性

  inheritAttrs: boolean // 表示是否将未声明为 props 的属性自动添加到组件的根元素
  propsOptions: object // 组件的 props 配置对象。包含了所有 props 的定义及其验证规则
  emit: Function | null // 组件的事件触发器。调用 emit 方法，可以触发父组件传递的事件监听器

  ctx: Data // 组件的上下文对象，存储代理的实例信息。通过 proxy 实现对 props、attrs、slots、setupState 等的统一访问
  data: Data // 组件实例的数据对象
  attrs: Data // 存储未声明为 props 的属性。通常用于透传属性给子组件或根元素
  props: Data // 组件的 props 数据。由父组件传递的属性，且经过 propsOptions 验证和处理
  slots: InternalSlots // 组件的插槽对象，存储了插槽的内容
  setupState: Data // 存储 setup 函数返回的响应式状态。用于组件内部的逻辑和数据管理

  isMounted: boolean // 组件是否已经完成挂载（mount）
  bm: Function[] | null // beforeMount ：组件挂载之前的生命周期钩子
  m: Function[] | null // mounted ：组件挂载完成之后的生命周期钩子
  bu: Function[] | null // beforeUpdate ：组件更新之前的生命周期钩子
  u: Function[] | null // updated ：组件更新完成之后的生命周期钩子
  bum: Function[] | null // beforeUnmount ：组件卸载之前的生命周期钩子
  um: Function[] | null // unmounted ：组件卸载之后的生命周期钩子
}

type CompileFunction = (
  template: string | object,
  options?: CompilerOptions,
  isGlobal?: boolean
) => any

let compile: CompileFunction

export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}

export function getComponentName(component) {
  return isFunction(component)
    ? (component as any).displayName || component.name
    : component.name
}

// 全局变量，用于保存当前正在初始化的组件实例
// eslint-disable-next-line import/no-mutable-exports
export let currentInstance

export function setCurrentInstance(instance) {
  currentInstance = instance
}

export function getCurrentInstance() {
  return currentInstance
}

// 创建组件实例
export function createComponentInstance(vnode, parent) {
  const type = vnode.type
  const data = (type.data && isFunction(type.data) ? type.data() : type.data) || {}
  const instance: ComponentInternalInstance = {
    type,
    vnode,
    next: null,
    subTree: null,
    parent,
    update: () => { },
    render: null,
    proxy: null,
    exposed: {},

    inheritAttrs: type.inheritAttrs,
    propsOptions: type.props || {},
    emit: null,

    ctx: {},
    data,
    attrs: {},
    props: {},
    slots: {},
    setupState: {},

    isMounted: false,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
  }

  instance.ctx = { _: instance }
  instance.emit = emit.bind(null, instance)
  return instance
}

// 判断当前组件是否是有状态的组件
function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
}

// 创建 setup 的上下文对象
// 提供 attrs、slots、emit 等属性，以及 expose 方法用于手动暴露组件实例的部分内容。
function createSetupContext(instance) {
  return {
    attrs: instance.attrs, // 非 props 的透传属性
    slots: instance.slots, // 插槽对象
    emit: instance.emit, // 用于触发父组件监听的事件
    expose: exposed => instance.exposed = exposed || {}, // 手动暴露属性/方法
  }
}

// 初始化有状态的组件 (Stateful Component)
// 负责调用 setup 函数，并处理其返回值，确保组件有一个可用的 render 函数，完成组件的核心设置
export function setupStatefulComponent(instance, isSSR = false) {
  const Component = instance.type
  const { setup } = Component

  // 使用 Proxy 对 instance.ctx 进行代理，拦截对实例的访问
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandler)

  if (setup) {
    // 创建 setup 的上下文对象
    const setupContext = createSetupContext(instance)

    // 暂停依赖追踪，避免运行期间意外触发响应式依赖
    pauseTracking()

    // 设置当前实例，供 setup 使用
    setCurrentInstance(instance)
    // 执行 setup 函数，并为 setup 提供只读的 props 和上下文对象 (setupContext)
    const setupResult = setup(shallowReadonly(instance.props), setupContext)
    setCurrentInstance(null)

    // 恢复依赖追踪
    enableTracking()

    if (isPromise(setupResult)) {
      if (isSSR) {
        return setupResult.then((resolvedResult) => {
          handleSetupResult(instance, resolvedResult, isSSR)
        })
      }
    }
    else {
      // 处理 setup 函数的返回结果，将其与当前的组件实例结合
      handleSetupResult(instance, setupResult, isSSR)
    }
  }
  else {
    // 完成组件的初始化
    finishComponentSetup(instance, isSSR)
  }
}

// 处理 setup 函数的返回值
function handleSetupResult(instance, setupResult, isSSR = false) {
  const { render } = instance.type

  if (isFunction(setupResult)) {
    // 如果 setup 返回的是一个函数
    // 则认为 setup 返回的是渲染函数（而不是数据对象或其他）
    // 将 setupResult 直接赋值给 instance.render，使得该组件的渲染函数来自于 setup

    if (render) {
      console.warn('setup 返回渲染函数，忽略 render 函数！')
    }

    instance.render = setupResult
  }
  else if (isObject(setupResult)) {
    // 如果 setup 返回的是一个函数
    // 通过 proxyRefs 对 ref 进行解包

    instance.setupState = proxyRefs(setupResult)
  }

  // 完成组件初始化
  finishComponentSetup(instance, isSSR)
}

// 完成组件的初始化
function finishComponentSetup(instance, isSSR) {
  const Component = instance.type
  const { render } = Component

  if (!instance.render) {
    // 如果 instance 没有 render 函数，说明 setup 函数没有返回渲染函数（也没有通过 setup 设置）。
    // 此时，将使用组件定义时的 render 函数
    instance.render = render

    if (!render && !isSSR) {
      // 如果组件没有 render 函数且不处于 SSR 渲染模式（!isSSR）
      // Vue 会检查是否有模板 (Component.template)，并且如果存在，会尝试使用 compile 函数将模板编译为渲染函数
      // compile 会根据模板创建一个 render 函数，并将其赋值给组件的 render 属性
      if (compile && Component.template) {
        Component.render = compile(Component.template, {}, Component.isGlobal)
      }
    }

    // 如果没有找到合适的 render 函数（如模板没有被编译或者没有 render 函数），则会将其设置为 NOOP，表示无操作的渲染函数
    instance.render = Component.render || NOOP
  }

  // 设置当前实例
  setCurrentInstance(instance)
  // 暂停依赖追踪（避免不必要的副作用）
  pauseTracking()
  // 应用组件的选项（如 data、props、methods 等），将其挂载到实例上
  applyOptions(instance)
  // 恢复依赖追踪，恢复正常的响应式系统
  enableTracking()
  // 清除当前实例
  setCurrentInstance(null)
}

// 全局变量：标识当前是否是处于 SSR 环境
// eslint-disable-next-line import/no-mutable-exports
export let isInSSRComponentSetup = false

// 初始化组件实例
export function setupComponent(instance, isSSR = false) {
  // 标记是否处于 SSR 环境
  isInSSRComponentSetup = isSSR

  // 调用 isStatefulComponent 判断组件是否为有状态组件
  const isStateful = isStatefulComponent(instance)

  const { props, children } = instance.vnode
  // 初始化组件的 props
  initProps(instance, props, isStateful, isSSR)
  // 初始化组件的 slots
  initSlots(instance, children)

  // 如果是有状态组件，调用 setupStatefulComponent 执行组件的 setup 函数并初始化组件状态
  // 否则， setupResult 为 undefined
  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined

  isInSSRComponentSetup = false
  return setupResult
}
