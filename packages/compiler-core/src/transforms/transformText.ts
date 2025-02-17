import type {
  CallExpression,

  InterpolationNode,
  TemplateChildNode,
  TextNode,
} from '../ast'
import type { NodeTransform } from '../transform'
import {
  isString,
  isSymbol,
  PatchFlagNames,
  PatchFlags,
} from '@mini-vue3/shared'
import {
  createCallExpression,
  NodeTypes,
} from '../ast'
import { CREATE_TEXT } from '../runtimeHelpers'

export const transformText: NodeTransform = (node, context) => {
  return () => {
    // 仅处理根节点和元素节点
    if (node.type === NodeTypes.ROOT || node.type === NodeTypes.ELEMENT) {
      const children = node.children // 获取子节点数组
      let currentContainer // 当前复合表达式容器
      let hasText = false // 是否存在文本标记

      // 第一阶段：合并相邻文本节
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          // eslint-disable-next-line unused-imports/no-unused-vars
          hasText = true

          // 扫描后续相邻文本节点
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]

            // 发现相邻文本
            if (isText(next)) {
              // 创建复合容器
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  children: [child],
                }
              }
              // 添加连接符
              currentContainer.children.push('+', next)
              // 移除已合并节点
              children.splice(j, 1)
              // 调整索引
              j--
            }
            // 遇到非文本节点
            else {
              currentContainer = undefined
              break
            }
          }

          // 单节点无需处理
          if (children.length === 1) {
            return
          }

          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
              const callArgs: CallExpression['arguments'] = []

              // 过滤纯空格文本
              if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
                callArgs.push(child)
              }

              // 添加动态标记（patch flag）
              if (child.type === NodeTypes.INTERPOLATION) {
                callArgs.push(
                  `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`,
                )
              }
              else if (child.type === NodeTypes.COMPOUND_EXPRESSION) {
                // eslint-disable-next-line array-callback-return
                child.children.some((c) => {
                  if (!isString(c) && !isSymbol(c)) {
                    return c.type === NodeTypes.INTERPOLATION
                  }
                }) && callArgs.push(
                  `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`,
                )
              }

              // 创建文本调用节点
              children[i] = {
                type: NodeTypes.TEXT_CALL, // 新节点类型
                content: child, // 原始内容
                // 生成调用表达式
                codegenNode: createCallExpression(
                  context.helper(CREATE_TEXT), // 获取_createText帮助函数
                  callArgs, // 参数数组
                ),
              }
            }
          }
        }
      }
    }
  }
}

// 类型守卫函数（判断是否为文本类节点）
export function isText(
  node: TemplateChildNode,
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}
