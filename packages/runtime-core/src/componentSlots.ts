import type { ComponentInternalInstance } from './component'
import { isArray, isFunction, ShapeFlags } from '@mini-vue3/shared'
import { normalizeVNode, type VNode } from './vnode'

export type Slot = (...args: any[]) => VNode[]

export interface InternalSlots {
  [name: string]: Slot | undefined
}

// 规范化单个插槽：将插槽内容转为一个数组形式的 VNode[]
const normalizeSlotValue = (value: unknown): VNode[] => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)]

// 规范化非对象形式的插槽内容
function normalizeVNodeSlots(instance: ComponentInternalInstance, children) {
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}

// 规范化对象形式的插槽内容，处理具名插槽
function normalizeObjectSlots(rawSlots, slots, _instance?) {
  for (const key in rawSlots) {
    const value = rawSlots[key]
    if (isFunction(value)) {
      slots[key] = () => normalizeSlotValue(value())
    }
    else {
      slots[key] = () => normalizeSlotValue(value)
    }
  }
}

// 初始化插槽
export function initSlots(instance, children) {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    // 如果是一个插槽对象（该插槽对象在 createVNode 函数中已格式化）
    // 现在进行第二次规范化
    // e.g.
    // h(component, {}, { default: () => h(xxx) }) => h(component, {}, { default: [() => h(xxx)] })
    // h(component, {}, () => h(xxx)) => h(component, {}, { default: [() => h(xxx)] })
    normalizeObjectSlots(children, (instance.slots = {}), instance)
  }
  else {
    // 如果没有插槽内容，则初始化为空对象
    instance.slots = {}

    if (children) {
      // e.g. h(component, {} [h(), h()]) => h(component, {}, {default: () => [h(), h()]})
      normalizeVNodeSlots(instance, children)
    }
  }
}

// 更新组件插槽内容，用于动态插槽场景
export function updateSlots(instance: ComponentInternalInstance, children) {
  const { vnode, slots } = instance
  if (vnode && vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    normalizeObjectSlots(children, slots, instance)
  }
  else if (children) {
    normalizeVNodeSlots(instance, children)
  }
}
