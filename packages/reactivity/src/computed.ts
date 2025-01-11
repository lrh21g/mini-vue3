import { isFunction } from '@mini-vue3/shared'
import { ReactiveFlags } from './constants'
import { createDep } from './dep'
import { ReactiveEffect } from './effect'
import { trackRefValue, triggerRefValue } from './ref'

class ComputedRefImpl {
  // 存储计算属性的依赖，当计算属性依赖的数据变更时，能够正确触发更新
  public dep
  // ReactiveEffect 实例，用于执行计算属性的 getter 函数
  public effect
  // 存储计算属性的计算结果，用于缓存计算属性的值
  // 当计算属性第一次计算时，这个值会被缓存，以便后续访问时直接返回，不用再次计算
  private _value
  // 标记计算属性是否需要重新计算
  private _dirty = true
  // 标识为 ref
  private readonly __v_isRef = true

  constructor(
    public getter,
    private readonly setter,
  ) {
    // 如果没有 setter，则是只读的 computed 属性
    this[ReactiveFlags.IS_READONLY] = !setter
    this.dep = createDep()

    // 创建一个 ReactiveEffect 实例，依赖 getter 函数，当 getter 被触发时，重新计算 value
    this.effect = new ReactiveEffect(
      getter,
      // 调度函数
      // 当计算属性依赖的响应式数据发生变化时，不会自动触发依赖，而是将控制权交给 scheduler 调度函数
      // 由于计算属性是当 getter 中的响应式数发生变化后，该计算属性的依赖会触发。所以在调度函数中直接触发计算属性所依赖的 effect 函数，就不会触发 getter 中响应式对象所收集的 effect
      () => {
        if (!this._dirty) {
          this._dirty = true
          // 触发计算属性被访问时收集的依赖
          triggerRefValue(this)
        }
      },
    )
  }

  // 属性访问器
  // 当访问计算属性的时候，收集当前计算属性所依赖的 effect，并且获取该计算属性的值（即执行 this.effect.run()，调用 getter 函数得到最终的结果）
  get value() {
    // 进行依赖收集
    trackRefValue(this)

    if (this._dirty) {
      this._dirty = false
      // 运行 ReactiveEffect 的 run 方法，执行 getter，计算新的值并缓存
      this._value = this.effect.run()
    }

    return this._value
  }

  set value(newValue) {
    // 如果计算属性有 setter，则调用 setter 更新计算属性的值
    if (this.setter) {
      this.setter(newValue)
    }
  }
}

export function computed(getterOrSetter) {
  const onlyGetter = isFunction(getterOrSetter)

  let getter
  let setter

  if (onlyGetter) {
    getter = getterOrSetter
    setter = () => {}
  }
  else {
    getter = getterOrSetter.get
    setter = getterOrSetter.set
  }

  return new ComputedRefImpl(getter, setter)
}
