import type { ParentNode, RootNode, TemplateChildNode } from './ast'
import type { TransformOptions } from './options'
import { NodeTypes } from './ast'
import { CREATE_COMMENT, TO_DISPLAY_STRING } from './runtimeHelpers'

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext
) => void | (() => void)

export interface TransformContext extends TransformOptions {
  replaceNode: NodeTransform // 替换当前节点
  removeNode: (node?: TemplateChildNode | undefined) => void // 移除当前节点
  parent: ParentNode | null // 当前节点的父节点
  childIndex: number // 当前节点在其父节点中的索引
  currentNode: RootNode | TemplateChildNode | null // 当前正在处理的节点
  helper: <T extends symbol>(name: T) => T // 用于注册辅助函数的工具方法，返回辅助函数的名称
  root: RootNode // 根节点
  helpers: Map<symbol, number> // 存储辅助函数及其调用次数的映射表
}

// AST 转换的入口函数
export function transform(root: RootNode, options: TransformOptions) {
  // 创建转换上下文 context
  const context = createTransformContext(root, options)
  // 遍历 AST 树
  traverseNode(root, context)
  // 处理根节点的代码生成
  createRootCodegen(root)
  // 将上下文中使用的辅助函数列表赋值给根节点的 helpers 属性
  root.helpers = [...context.helpers.keys()]
}

// 为根节点生成代码生成节点
function createRootCodegen(root: RootNode) {
  const { children } = root

  // 如果根节点只有一个子节点
  if (children.length === 1) {
    const child = children[0]
    if (child.type === NodeTypes.ELEMENT && child.codegenNode) {
      const codegenNode = child.codegenNode
      root.codegenNode = codegenNode
    }
    else {
      root.codegenNode = child
    }
  }
  else if (children.length > 1) {
    // TODO Fragment多根节点
  }
}

// 创建转换上下文，提供节点操作方法和状态管理
function createTransformContext(root: RootNode, { nodeTransforms = [], directiveTransforms = {} }: TransformOptions) {
  const context = {
    // 删除当前节点
    removeNode: (_node) => {
      if (context.parent) {
        context.parent.children.splice(context.childIndex, 1)
        context.currentNode = null // 标记节点已删除
      }
    },
    // 替换当前节点
    replaceNode: (node) => {
      // 新节点替换父节点 children 中 childIndex 所在的节点
      context.parent.children[context.childIndex] = node
      // 当前节点替换成目标节点
      context.currentNode = node
    },
    parent: null as any, // 当前父节点
    childIndex: 0, // 当前节点在父节点中的索引
    currentNode: null, // 当前处理的节点
    nodeTransforms, // 节点转换插件
    directiveTransforms, // 指令转换逻辑（如 v-if/v-for）
    // 记录辅助函数使用次数
    helper(name) {
      const count = context.helpers.get(name) || 0
      context.helpers.set(name, count + 1)
      return name
    },
    root, // 根节点
    helpers: new Map(), // 存储辅助函数
  }
  return context
}

// 递归处理单个节点，对每个节点应用转换规则
function traverseNode(node: RootNode | TemplateChildNode, context: TransformContext) {
  context.currentNode = node
  const transforms = context.nodeTransforms
  const exitFns = [] as any

  // 应用节点转换插件（进入阶段）
  if (transforms) {
    for (let i = 0; i < transforms.length; i++) {
      const onExit = transforms[i](context.currentNode, context)
      if (onExit) {
        exitFns.push(onExit)
      }
      // 节点被删除时终止
      if (!context.currentNode) {
        return
      }
      else {
        node = context.currentNode
      }
    }
  }

  // 子节点处理
  switch (node.type) {
    case NodeTypes.COMMENT:
      context.helper(CREATE_COMMENT) // 需要生成注释的辅助函数
      break
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING) // 需要插值表达式处理函数
      break
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context) // 递归处理子节点
      break
    default:
      break
  }

  // 执行退出阶段的回调（后置处理）
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

// 遍历父节点的所有子节点，更新上下文中的父子关系
function traverseChildren(parent: ParentNode, context: TransformContext) {
  const children = parent.children
  children && children.forEach((node, index) => {
    context.parent = parent // 设置父节点
    context.childIndex = index // 设置当前子节点索引
    traverseNode(node, context) // 递归处理子节点
  })
}
