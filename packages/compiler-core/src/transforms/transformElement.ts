import type {
  CallExpression,
  ExpressionNode,
  ObjectExpression,
} from '../ast'
import type { NodeTransform } from '../transform'
import {
  isOn,
  PatchFlagNames,
  PatchFlags,
} from '@mini-vue3/shared'
import {
  createCallExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createVNodeCall,
  ElementTypes,
  NodeTypes,
} from '../ast'
import {
  GUARD_REACTIVE_PROPS,
  MERGE_PROPS,
  NORMALIZE_CLASS,
  NORMALIZE_PROPS,
  NORMALIZE_STYLE,
} from '../runtimeHelpers'
import { isStaticExp } from '../utils'

export type PropsExpression = ObjectExpression | CallExpression | ExpressionNode

export const transformElement: NodeTransform = (node, context) => {
  // 在 退出阶段 处理元素节点（确保子节点已处理完成）
  return () => {
    node = context.currentNode as any

    // 确保仅处理元素类型节点
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }

    const {
      tag, // 标签名
      props, // 属性列表
    } = node
    // 标识当前元素是否是一个组件
    const isComponent = node.tagType === ElementTypes.COMPONENT
    const vnodeTag = `"${tag}"` // 将标签名转换为字符串形式
    let vnodeProps
    let vnodeChildren
    let vnodePatchFlag
    let patchFlag = 0
    let vnodeDynamicProps
    let dynamicPropNames
    let vnodeDirectives

    // 处理 props ，调用 buildProps 构建属性相关信息
    if (props.length > 0) {
      const propsBuildResult = buildProps(node, context)
      vnodeProps = propsBuildResult.props // 属性对象
      patchFlag = propsBuildResult.patchFlag // 需要更新的标志位
      dynamicPropNames = propsBuildResult.dynamicPropNames // 动态属性名列表
      vnodeDirectives = propsBuildResult.directives // 指令列表
    }

    // 处理子节点
    if (node.children.length > 0) {
      // 单个子节点
      if (node.children.length === 1) {
        const child = node.children[0]
        const type = child.type
        // 判断子节点是否为动态文本（插值或复合表达式）
        const hasDynamicTextChild = type === NodeTypes.INTERPOLATION || type === NodeTypes.COMPOUND_EXPRESSION

        // 如果是动态文本，设置 patchFlag 的 TEXT 标志
        if (hasDynamicTextChild) {
          patchFlag |= PatchFlags.TEXT
        }

        // 如果子节点类型是文本或包含动态文本，则直接将子节点赋值给 vnodeChildren
        // 否则保留所有子节点。
        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          vnodeChildren = child
        }
        else {
          vnodeChildren = node.children
        }
      }
      // 多个子节点
      else {
        vnodeChildren = node.children
      }
    }

    if (patchFlag !== 0) {
      // patchFlag 为负数，则说明不存在复合情况
      if (patchFlag < 0) {
        vnodePatchFlag = `${patchFlag} /* ${PatchFlagNames[patchFlag]} */`
      }
      // patchFlag 为正数，说明可能存在复合情况，特殊处理
      // e.g. 9 /* TEXT, CLASS */ // 表示文本和类名是动态的
      else {
        const flagNames = Object
          // 获取 PatchFlagNames 中所有的键名
          .keys(PatchFlagNames)
          // 全部转换为 Number 类型
          .map(Number)
          // 只保留 patchFlag 中存在的，并且值大于 0 的
          .filter(n => n > 0 && patchFlag & n)
          // 将 patchFlag 数值转换成对应 patchFlag 名称
          .map(n => PatchFlagNames[n])
          // 使用逗号连接
          .join(', ')

        // 将上面的内容注释在 patchFlag 后面作为一个参考
        vnodePatchFlag = `${patchFlag} /* ${flagNames} */`
      }

      // TODO 处理动态属性名
      if (dynamicPropNames && dynamicPropNames.length) {
        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames)
      }
    }

    // 构造代码生成节点
    node.codegenNode = createVNodeCall(
      context,
      vnodeTag, // 标签名（字符串）
      vnodeProps, // 处理后的属性对象
      vnodeChildren, // 子节点数组或单个节点
      vnodePatchFlag, // 带注释的 patchFlag
      vnodeDynamicProps, // 动态属性名数组字符串
      vnodeDirectives, // 指令信息
      isComponent, // 是否为组件
    )
  }
}

// 将动态属性名列表序列化为字符串形式
// e.g. ['id', 'class'] => '["id","class"]'
function stringifyDynamicPropNames(props) {
  let propsNamesString = '['
  for (let i = 0, l = props.length; i < l; i++) {
    propsNamesString += JSON.stringify(props[i])
    if (i < l - 1)
      propsNamesString += ','
  }
  return `${propsNamesString}]`
}

// 用于处理 AST 节点的属性
function buildProps(node, context, props = node.props) {
  const isComponent = node.tagType === ElementTypes.COMPONENT // 判断当前节点是否为组件节点
  let properties = [] as any // 存储静态属性（如 class="container"）
  const mergeArgs = [] as any // 存储动态绑定需要合并的对象（如 v-bind="obj"）
  const runtimeDirectives = [] as any // 需要运行时处理的指令（如自定义指令）

  let patchFlag = 0 // 标记需要动态更新的部分
  let hasClassBinding = false // 是否存在类绑定
  let hasStyleBinding = false // 是否存在样式绑定
  let hasHydrationEventBinding = false // 是否存在事件绑定
  let hasDynamicKeys = false // 是否存在动态键
  const dynamicPropNames: string[] = []

  const analyzePatchFlag = ({ key }) => {
    // 静态键名（如 :class）
    if (isStaticExp(key)) {
      const name = key.content
      const isEventHandler = isOn(name) // 是否以 on 开头的事

      // 处理非原生组件的事件绑定
      // e.g. <div @custom-event="handler"> → 标记 hasHydrationEventBinding
      if (
        !isComponent
        && isEventHandler
        && name.toLowerCase() !== 'onclick'
      ) {
        hasHydrationEventBinding = true
      }

      // 处理 class
      // e.g. <div :class="cls"> → 标记 hasClassBinding
      if (name === 'class') {
        hasClassBinding = true
      }
      // 处理 style
      else if (name === 'style') {
        hasStyleBinding = true
      }
      // 记录动态属性名（排除 key）
      else if (name !== 'key' && !dynamicPropNames.includes(name)) {
        dynamicPropNames.push(name)
      }

      // 组件上的 class/style 必须显式追踪
      if (
        isComponent
        && (name === 'class' || name === 'style')
        && !dynamicPropNames.includes(name)
      ) {
        dynamicPropNames.push(name)
      }
    }
    // 动态键名（如 :[key]）
    else {
      hasDynamicKeys = true
    }
  }

  for (let i = 0; i < props.length; i++) {
    const prop = props[i]

    // 处理普通属性（非指令）
    // 将静态属性转换为对象属性（如 class="container" → { class: "container" }）
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { name, value } = prop
      const valueNode = createSimpleExpression(value || '', true)

      properties.push(
        createObjectProperty(
          createSimpleExpression(name, true), // 键名（静态）
          valueNode, // 值（静态）
        ),
      )
    }
    else {
      const { name, arg, exp } = prop
      const isVBind = name === 'bind'
      const isVOn = name === 'on'

      // 处理无参数的 v-bind/v-on（动态键）
      if (!arg && (isVBind || isVOn)) {
        hasDynamicKeys = true

        if (exp) {
          if (properties.length) {
            mergeArgs.push(
              createObjectExpression(properties),
            )
            properties = []
          }

          // v-bind ，合并对象到 mergeArgs
          if (isVBind) {
            mergeArgs.push(exp)
          }
          // v-on ，转换为事件对象
          else {
            mergeArgs.push({
              type: NodeTypes.JS_CALL_EXPRESSION,
              arguments: [exp],
            })
          }
        }
        continue
      }

      // 处理内置指令转换（如 v-model）
      // e.g. v-model 转换为 modelValue 和 onUpdate:modelValue
      const directiveTransform = context.directiveTransforms[name]
      if (directiveTransform) {
        const { props, needRuntime } = directiveTransform(prop, node, context)
        props.forEach(analyzePatchFlag)
        properties.push(...props)
        if (needRuntime) {
          runtimeDirectives.push(prop)
        }
      }
      // 自定义指令
      else {
        runtimeDirectives.push(prop)
      }
    }
  }

  let propsExpression: PropsExpression | undefined
  // 合并动态绑定与静态属性
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(createObjectExpression(properties))
    }
    // 合并多个对象
    if (mergeArgs.length > 1) {
      propsExpression = createCallExpression(
        context.helper(MERGE_PROPS),
        mergeArgs,
      )
    }
    else {
      propsExpression = mergeArgs[0]
    }
  }
  // 纯静态属性
  else if (properties.length) {
    propsExpression = createObjectExpression(properties)
  }

  // 计算 PatchFlag
  if (hasDynamicKeys) {
    patchFlag |= PatchFlags.FULL_PROPS
  }
  else {
    if (hasClassBinding && !isComponent) {
      patchFlag |= PatchFlags.CLASS
    }
    if (hasStyleBinding && !isComponent) {
      patchFlag |= PatchFlags.STYLE
    }
    if (dynamicPropNames.length) {
      patchFlag |= PatchFlags.PROPS
    }
    if (hasHydrationEventBinding) {
      patchFlag |= PatchFlags.HYDRATE_EVENTS
    }
  }

  // 标记需要动态更新的内容
  if (
    (patchFlag === 0 || patchFlag === PatchFlags.HYDRATE_EVENTS)
    && runtimeDirectives.length > 0
  ) {
    patchFlag |= PatchFlags.NEED_PATCH
  }

  // 规范化处理
  if (propsExpression) {
    switch (propsExpression.type) {
      // 对象表达式处理（JS_OBJECT_EXPRESSION）
      case NodeTypes.JS_OBJECT_EXPRESSION: {
        // 记录 class 和 style 属性的位置
        let classKeyIndex = -1
        let styleKeyIndex = -1
        // 标记是否存在动态键名（如 :[key]="value"）
        let hasDynamicKey = false

        for (let i = 0; i < propsExpression.properties.length; i++) {
          const key = propsExpression.properties[i].key
          // 静态键名（如 "class"）
          if (isStaticExp(key)) {
            if (key.content === 'class') {
              classKeyIndex = i
            }
            else if (key.content === 'style') {
              styleKeyIndex = i
            }
          }
          // 动态键名且非事件处理
          else if (!key.isHandlerKey) {
            hasDynamicKey = true
          }
        }

        // 获取 class/style 属性
        const classProp = propsExpression.properties[classKeyIndex]
        const styleProp = propsExpression.properties[styleKeyIndex]

        // 无动态键的处理
        if (!hasDynamicKey) {
          // 规范化 class
          // e.g. { class: dynamicClass } => { class: _normalizeClass(dynamicClass) }
          if (classProp && !isStaticExp(classProp.value)) {
            classProp.value = createCallExpression(context.helper(NORMALIZE_CLASS), [classProp.value])
          }

          // 规范化 style
          // e.g. { style: dynamicStyle } => { style: _normalizeStyle(dynamicStyle) }
          if (
            styleProp
            && !isStaticExp(styleProp.value)
            && (hasStyleBinding
              || styleProp.value.type === NodeTypes.JS_ARRAY_EXPRESSION)
          ) {
            styleProp.value = createCallExpression(context.helper(NORMALIZE_STYLE), [styleProp.value])
          }
        }
        // 存在动态键
        // e.g. { [dynamicKey]: value } => _normalizeProps({ [dynamicKey]: value })
        else {
          propsExpression = createCallExpression(context.helper(NORMALIZE_PROPS), [propsExpression])
        }
        break
      }
      // 调用表达式处理（JS_CALL_EXPRESSION）
      case NodeTypes.JS_CALL_EXPRESSION:
        break
      // 默认处理（其他类型）
      default:
        propsExpression = createCallExpression(
          context.helper(NORMALIZE_PROPS),
          [
            createCallExpression(
              context.helper(GUARD_REACTIVE_PROPS),
              [propsExpression],
            ),
          ],
        )
        break
    }
  }

  return {
    props: propsExpression,
    directives: runtimeDirectives,
    patchFlag,
    dynamicPropNames,
  }
}
