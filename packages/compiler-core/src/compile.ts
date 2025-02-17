import type { RootNode } from './ast'
import type { CodegenResult } from './codegen'
import type { CompilerOptions } from './options'
import { extend, isString } from '@mini-vue3/shared'
import { generate } from './codegen'
import { baseParse } from './parse'
import { transform } from './transform'
import { transformElement } from './transforms/transformElement'
import { transformExpression } from './transforms/transformExpression'
import { transformText } from './transforms/transformText'
import { transformBind } from './transforms/vBind'
import { transformOn } from './transforms/vOn'

// 将模板字符串（或已经解析过的 AST）编译成最终的代码
export function baseCompile(
  template: string | RootNode, // 模板字符串或已解析的 AST（抽象语法树）
  options: CompilerOptions = {}, // 编译选项
): CodegenResult {
  // 如果 template 是字符串类型，则使用 baseParse 函数将其解析为 AST
  // 如果 template 已经是 AST（类型为 RootNode），则直接使用
  const ast = isString(template) ? baseParse(template, options) : template

  // 使用 transform 函数对 AST 进行转换
  transform(
    ast,
    extend(
      {},
      options,
      {
        // 用于处理不同类型的节点
        nodeTransforms: [
          transformElement, // 转换元素节点
          transformText, // 转换文本节点
          transformExpression, // 转换表达式节点
        ],
        // 用于处理 on 和 bind 指令
        directiveTransforms: {
          on: transformOn,
          bind: transformBind,
        },
      },
    ),
  )

  // 经过转换后的 AST 被传入 generate 函数，生成最终的代码
  return generate(
    ast,
    extend(
      {},
      options,
      {},
    ),
  )
}
