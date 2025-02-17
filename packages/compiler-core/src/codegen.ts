import type { CodegenOptions } from './options'
import { isArray, isString, isSymbol, toRawType } from '@mini-vue3/shared'
import { type CallExpression, type CommentNode, type JSChildNode, NodeTypes, type RootNode, type TemplateChildNode } from './ast'
import { CREATE_COMMENT, CREATE_ELEMENT_VNODE, helperNameMap, TO_DISPLAY_STRING } from './runtimeHelpers'

// 代码生成节点
export type CodegenNode = TemplateChildNode | JSChildNode

// 代码生成结果
export interface CodegenResult {
  code: string // 生成的代码字符串
  ast: RootNode // 生成的抽象语法树（AST）
}

// 代码生成的上下文环境
export interface CodegenContext extends Required<CodegenOptions> {
  code: string // 当前生成的代码字符串
  push: (code: string) => void // 用于将代码片段添加到生成的代码中
  indentLevel: number // 当前的缩进层级
  indent: () => void // 用于增加缩进层级
  deIndent: () => void // 用于减少缩进层级
  newline: () => void // 用于添加换行
  helper: (key: symbol) => string // // 运行时帮助函数引用：接受一个符号键 key，返回对应的帮助函数名称字符串
}

// 创建代码生成的上下文对象 CodegenContext
function createCodegenContext({
  mode = 'function', // 编译模式，默认为 'function'
  prefixIdentifiers = mode === 'module', // 是否在生成的代码中为标识符添加前缀
  runtimeModuleName = 'miniVue3', // 运行时模块的名称，默认为 'miniVue3'
  runtimeGlobalName = 'MiniVue3', // 运行时全局变量的名称，默认为 'MiniVue3'
}: CodegenOptions): CodegenContext {
  const context = {
    mode,
    prefixIdentifiers,
    runtimeModuleName,
    runtimeGlobalName,
    code: '', // 用于存储生成的代码字符串
    // 接受一个键 key，返回对应的帮助函数名称字符串，前缀为下划线
    helper(key) {
      return `_${helperNameMap[key]}`
    },
    // 接受一个代码片段 code，将其追加到 code 属性中
    push(code) {
      context.code += code
    },
    // 用于记录当前的缩进级别，初始值为 0
    indentLevel: 0,
    // 用于在生成的代码中插入换行符,并根据当前的缩进级别添加相应数量的空格
    newline() {
      context.code += `\n${'  '.repeat(context.indentLevel)}`
    },
    // 增加 indentLevel 的值，并调用 newline 方法添加换行和缩进
    indent() {
      context.indentLevel++
      context.newline()
    },
    // 减少 indentLevel 的值，并调用 newline 方法添加换行和缩进
    deIndent() {
      if (context.indentLevel > 0) {
        context.indentLevel--
        context.newline()
      }
    },
  }
  return context
}

// 责将转换后的抽象语法树（AST）生成最终的渲染函数代码
export function generate(ast: RootNode, options: CodegenOptions): CodegenResult {
  // 创建代码生成上下文
  const context = createCodegenContext(options)
  const {
    mode,
    push,
    prefixIdentifiers,
    indent,
    deIndent,
    newline,
  } = context

  // 根据模式生成前置代码，主要用于引入辅助函数和设置运行时环境
  if (mode === 'module') {
    genModulePreamble(ast, context)
  }
  else {
    genFunctionPreamble(ast, context)
  }

  // 判断是否存在辅助函数
  const hasHelpers = ast.helpers.length > 0
  // 判断是否使用 with 块： with(this) {}
  // 当编译模式不是 'module' 并且没有启用 prefixIdentifiers 选项时，通常用于非模块化的环境，或者是在需要简化变量引用的情况下
  const useWithBlock = !prefixIdentifiers && mode !== 'module'
  // 定义渲染函数的名称
  const functionName = 'render'
  // 定义渲染函数的参数数组
  const args = ['_ctx', '$props', '$setup', '$data', '$options']
  // 将参数数组用逗号连接成字符串，作为函数的参数列表
  const signature = args.join(', ')

  // 将渲染函数的定义添加到生成的代码中，并调用 indent 增加缩进。
  push(`function ${functionName}(${signature}) {`)
  indent()

  // 如果使用 with 块
  if (useWithBlock) {
    // 将 with 块的开头代码添加到 context.code 中
    push(`with (_ctx) {`)
    indent()

    if (hasHelpers) {
      // 使用 map 方法将 ast.helpers 数组中的每个辅助函数名称进行转换，然后用逗号连接成字符串，生成导入辅助函数的代码
      push(`const {
        ${ast.helpers.map(s => `${helperNameMap[s]}: _${helperNameMap[s]}`).join(', ')}
        } = _${context.runtimeGlobalName}`)
      push(`\n`)
      newline()
    }
  }

  // 添加 return 关键字到 context.code 中
  push(`return `)
  // 如果 ast 有 codegenNode，则调用 genNode 函数处理 ast.codegenNode，将生成的代码添加到 context.code 中
  // 否则，添加 null 到 context.code 中
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context)
  }
  else {
    push(`null`)
  }

  // 如果使用 with 块，则减少缩进层次，并添加 } 关闭 with 块
  if (useWithBlock) {
    deIndent()
    push(`}`)
  }

  // 减少缩进层次，添加 } 关闭渲染函数
  deIndent()
  push(`}`)

  // 返回代码生成结果
  return {
    code: context.code,
    ast,
  }
}

// 用于生成代码的前置代码（模块模式），主要用于导入辅助函数和添加 export 关键字
function genModulePreamble(ast: RootNode, context: CodegenContext) {
  const { push, newline, runtimeModuleName } = context

  // 生成导入辅助函数的代码
  if (ast.helpers.length) {
    push(`import {
      ${ast.helpers
        .map(helper => `${helperNameMap[helper]} as _${helperNameMap[helper]}`)
        .join(', ')}
      } from "${runtimeModuleName}"\n`)
  }

  // 插入换行符并添加 export 关键字
  newline()
  push('export ')
}

// 用于生成代码的前置代码（函数模式），主要用于创建全局对象的局部引用和添加 return 关键字
function genFunctionPreamble(ast: RootNode, context: CodegenContext) {
  const { push, newline, runtimeGlobalName } = context

  // 创建一个局部常量 _${runtimeGlobalName} 引用全局变量 runtimeGlobalName ，在后续代码中可以使用这个局部常量来引用全局对象
  push(`const _${runtimeGlobalName} = ${runtimeGlobalName} \n`)

  // 插入换行符并添加 return 关键字
  newline()
  push('return ')
}

// 根据不同类型的节点生成对应代码，将节点转换为具体的代码片段，并添加到代码生成上下文中
function genNode(
  node: CodegenNode | symbol | string, // 待生成代码的节点
  context: CodegenContext, // 代码生成的上下文，包含生成代码所需的辅助方法和状态
) {
  // 如果 node 是字符串类型，直接将其推送到生成的代码中
  if (isString(node)) {
    context.push(node)
    return
  }

  // 如果 node 是 Symbol 类型，调用 context.helper 获取对应的辅助函数，并将其推送到生成的代码中
  if (isSymbol(node)) {
    context.push(context.helper(node))
    return
  }

  switch (node.type) {
    // 元素节点，表示 HTML 元素
    case NodeTypes.ELEMENT:
      genElement(node, context)
      break
    // 注释节点，表示 HTML 注释
    case NodeTypes.COMMENT:
      genComment(node, context)
      break
    // 文本调用，表示创建文本节点的函数调用
    case NodeTypes.TEXT_CALL:
      genNode(node.codegenNode, context)
      break
    // 文本节点，表示纯文本内容
    case NodeTypes.TEXT:
      genText(node, context)
      break
    // 插值节点，表示模板中的插值表达式 {{xxx}}
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context)
      break
    // 复合表达式节点，表示由多个表达式组成的复合表达式
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context)
      break
    // JavaScript 调用表达式节点
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context)
      break
  }
}

// 生成函数调用表达式节点的代码
function genCallExpression(node: CallExpression, context: CodegenContext) {
  const { push, helper } = context
  // 检查 node.callee 是否为字符串类型
  // > 如果是字符串，直接赋值给 callee
  // > 如果不是字符串，调用 helper 方法获取对应的辅助函数名称
  const callee = isString(node.callee) ? node.callee : helper(node.callee)

  // 生成函数调用的开头部分，添加到生成的代码中
  push(`${callee}(`)
  // 处理函数调用的参数，添加到生成的代码中
  genNodeList(node.arguments, context)
  // 生成函数调用的结尾部分，并添加到生成的代码中
  push(`)`)
}

// 将函数调用表达式的参数列表（_arguments）转换为对应的代码字符串
function genNodeList(_arguments: CallExpression['arguments'], context: CodegenContext) {
  const { push } = context

  for (let i = 0; i < _arguments.length; i++) {
    const node = _arguments[i]

    // 如果节点是字符串类型，直接将其推送到生成的代码中
    if (isString(node)) {
      push(node)
    }
    // 如果节点是数组类型，递归调用 genNodeList 处理该数组
    else if (isArray(node)) {
      genNodeList(node, context)
    }
    // 否则，调用 genNode 函数处理该节点
    else {
      genNode(node, context)
    }

    // 如果当前节点不是参数列表中的最后一个节点
    // 使用 push 方法在生成的代码中添加逗号和空格，以分隔参数
    if (i < _arguments.length - 1) {
      push(', ')
    }
  }
}

// 生成注释节点的代码
function genComment(node: CommentNode, context: CodegenContext) {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { push, deIndent, helper } = context
  const { content } = node

  push(`${helper(CREATE_COMMENT)} (${JSON.stringify(content)}) `)
}

// 生成元素节点的代码
function genElement(node, context: CodegenContext) {
  const { push, deIndent } = context
  const { tag, children, props, patchFlag } = node

  // 生成创建 VNode 的调用表达式开始部分
  push(`${context.helper(CREATE_ELEMENT_VNODE)}(${tag}, `)

  // 处理属性（Props）
  if (props) {
    genProps(props.properties, context)
  }
  else {
    push('null, ')
  }

  // 处理子节点（Children）
  if (children) {
    genChildren(children, context)
  }
  else {
    push('null')
  }

  if (patchFlag) {
    push(`, ${patchFlag}`)
  }

  deIndent()
  push(')')
}

// 将元素的属性列表（props）转换为对应的 JavaScript 对象字面量代码字符串
function genProps(props, context) {
  const { push } = context

  // 处理空属性列表的情况
  if (!props.length) {
    push('{}')
    return
  }

  push('{ ')
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]

    // 获取属性的键和值
    const key = prop ? prop.key : ''
    const value = prop ? prop.value : prop

    // 如果 key 存在
    if (key) {
      // key
      genPropKey(key, context)
      // value
      genPropValue(value, context)
    }
    // 如果 key 不存在，是动态生成的键值对
    // 提取 value 的 content 和 isStatic 属性
    // 如果 isStatic 为 true，使用字符串形式的 content；否则直接使用 content
    else {
      const { content, isStatic } = value
      const contentStr = JSON.stringify(content)
      push(`${contentStr}: ${isStatic ? contentStr : content}`)
    }

    if (i < props.length - 1) {
      push(', ')
    }
  }
  push(' }, ')
}

function genPropKey(node, context) {
  const { push } = context
  const { isStatic, content } = node

  push(isStatic ? JSON.stringify(content) : content)
  push(': ')
}

function genPropValue(node, context) {
  const { push } = context
  const { isStatic, content } = node
  push(isStatic ? JSON.stringify(content.content) : content)
}

// 生成元素的 children（子节点）的代码
function genChildren(children, context) {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { push, indent, deIndent } = context

  // 处理对象类型的子节点
  if (toRawType(children) === 'Object') {
    indent()
    // 调用 genNode 递归地生成该子节点的代码
    genNode(children, context)
  }
  // 处理复合表达式类型的子节点
  else if (children.type === NodeTypes.COMPOUND_EXPRESSION) {
    genCompoundExpression(children, context)
  }
  // 处理其他类型的子节点
  else {
    push('[')
    indent()
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      genNode(child.codegenNode || child.children || child, context)
      push(', ')
    }
    push(']')
  }
}

function genText(node, context) {
  const { push } = context
  const { content } = node
  push(JSON.stringify(content))
}

function genInterpolation(node, context) {
  const { push, helper } = context
  const { content } = node

  push(`${helper(TO_DISPLAY_STRING)}(${content.content})`)
}

function genCompoundExpression(node, context) {
  const { push } = context
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (isString(child)) {
      push(` ${child} `)
    }
    else {
      genNode(child, context)
    }
  }
}
