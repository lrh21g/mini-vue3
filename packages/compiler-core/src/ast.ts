import type { TransformContext } from './transform'
import type { PropsExpression } from './transforms/transformElement'
import { isString } from '@mini-vue3/shared'
import { CREATE_ELEMENT_VNODE } from './runtimeHelpers'

// 节点类型
export enum NodeTypes {
  ROOT = 'ROOT', // 根节点，表示整个模板
  ELEMENT = 'ELEMENT', // 元素节点，表示 HTML 元素
  TEXT = 'TEXT', // 文本节点，表示纯文本内容
  COMMENT = 'COMMENT', // 注释节点，表示 HTML 注释
  INTERPOLATION = 'INTERPOLATION', // 插值节点，表示模板中的插值表达式 {{xxx}}
  ATTRIBUTE = 'ATTRIBUTE', // 属性节点，表示元素的属性
  DIRECTIVE = 'DIRECTIVE', // 指令节点，表示 Vue 的指令（如 v-if、v-for 等）
  SIMPLE_EXPRESSION = 'SIMPLE_EXPRESSION', // 简单表达式节点，表示简单的 JavaScript 表达式

  // 代码生成相关节点类型
  VNODE_CALL = 'VNODE_CALL', // 虚拟节点调用，表示创建虚拟节点的函数调用
  TEXT_CALL = 'TEXT_CALL', // 文本调用，表示创建文本节点的函数调用
  COMPOUND_EXPRESSION = 'COMPOUND_EXPRESSION', // 复合表达式节点，表示由多个表达式组成的复合表达式

  // JavaScript 表达式节点类型
  JS_ARRAY_EXPRESSION = 'JS_ARRAY_EXPRESSION', // JavaScript 数组表达式节点
  JS_FUNCTION_EXPRESSION = 'JS_FUNCTION_EXPRESSION', // JavaScript 函数表达式节点
  JS_CALL_EXPRESSION = 'JS_CALL_EXPRESSION', // JavaScript 调用表达式节点
  JS_BLOCK_STATEMENT = 'JS_BLOCK_STATEMENT', // JavaScript 块语句节点
  JS_RETURN_STATEMENT = 'JS_RETURN_STATEMENT', // JavaScript 返回语句节点
  JS_OBJECT_EXPRESSION = 'JS_OBJECT_EXPRESSION', // JavaScript 对象表达式节点
  JS_PROPERTY = 'JS_PROPERTY', // JavaScript 属性节点
}

// 元素类型
export enum ElementTypes {
  ELEMENT, // 普通 HTML 元素
  COMPONENT, // 组件节点
  SLOT, // 插槽节点
  TEMPLATE, // template 模板节点
}

export type ParentNode = RootNode | ElementNode

export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode

// 所有节点的基础接口，包含 type 属性，表示节点类型
export interface Node {
  type: NodeTypes
}

// 元素节点的基础接口
export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string // 标签名
  tagType: ElementTypes // 元素类型
  isSelfClosing: boolean // 是否自闭合标签
  props: Array<AttributeNode | DirectiveNode> // 属性/指令集合
  children: TemplateChildNode[] // 子节点
}

// 普通 HTML 节点
export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT
  codegenNode: TemplateChildNode
}

// 组件节点
export interface ComponentNode extends BaseElementNode {
  tagType: ElementTypes.COMPONENT
  codegenNode: TemplateChildNode
}

// 插槽节点
export interface SlotOutletNode extends BaseElementNode {
  tagType: ElementTypes.SLOT
  codegenNode: TemplateChildNode
}

// Template 模版节点
export interface TemplateNode extends BaseElementNode {
  tagType: ElementTypes.TEMPLATE
  codegenNode: TemplateChildNode | JSChildNode
}

// 多种具体元素类型继承基类
export type ElementNode =
  | PlainElementNode
  | ComponentNode
  | SlotOutletNode
  | TemplateNode

// 根节点接口
export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: TemplateChildNode[]
  codegenNode?: TemplateChildNode | JSChildNode
  helpers: symbol[]
}

// 属性节点
export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined // 属性值（静态文本）
}

// 指令节点
// e.g. <div v-bind:class="a">
//
// {
//   name: 'bind',
//   exp: {
//     type: SIMPLE_EXPRESSION,
//     content: 'a',
//     isStatic: false
//   },
//   arg: {
//     type: SIMPLE_EXPRESSION,
//     content: 'class',
//     isStatic: true
//   }
// }
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string // 指令名（v-开头）
  exp: ExpressionNode | undefined // 表达式（如 v-if="exp"）
  arg: ExpressionNode | undefined // 参数（如 v-on:click）
  modifiers?: string[] // 修饰符（如 .sto
}

// 文本节点
export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

// 注释节点
export interface CommentNode extends Node {
  type: NodeTypes.COMMENT
  content: string
}

// 插值节点
// e.g. {{ message }}
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: ExpressionNode
}

export type TemplateChildNode =
  | ElementNode
  | TextNode
  | CommentNode
  | CompoundExpressionNode
  | InterpolationNode
  | TextCallNode

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION
  content: string // 表达式内容
  isStatic: boolean // 是否静态
}

export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
    | symbol
  )[]
  isHandlerKey?: boolean
}

export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  body?: BlockStatement
}

export interface BlockStatement extends Node {
  type: NodeTypes.JS_BLOCK_STATEMENT
  body: (JSChildNode)[]
}

export interface ReturnStatement extends Node {
  type: NodeTypes.JS_RETURN_STATEMENT
  returns: TemplateChildNode | TemplateChildNode[] | JSChildNode
}

export interface DirectiveArguments extends ArrayExpression {
  elements: DirectiveArgumentNode[]
}

export interface DirectiveArgumentNode extends ArrayExpression {
  elements:
    | [string]
    | [string, ExpressionNode]
    | [string, ExpressionNode, ExpressionNode]
    | [string, ExpressionNode, ExpressionNode, ObjectExpression]
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ExpressionNode
  | FunctionExpression

export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION
  properties: Array<Property>
}

export interface Property extends Node {
  type: NodeTypes.JS_PROPERTY
  key: ExpressionNode
  value: JSChildNode
}

export interface ArrayExpression extends Node {
  type: NodeTypes.JS_ARRAY_EXPRESSION
  elements: Array<string | Node>
}
export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION
  callee: string | symbol // 调用函数名
  arguments: (
    | string
    | symbol
    | JSChildNode
    | TemplateChildNode
    | TemplateChildNode[]
  )[] // 参数
}

export interface VNodeCall extends Node {
  type: NodeTypes.ELEMENT
  tag: string | symbol | CallExpression // 标签名或组件
  props: PropsExpression | undefined // 属性表达式
  children: // 子节点
    | TemplateChildNode[]
    | SimpleExpressionNode
    | undefined
  patchFlag: string | undefined // 优化标识
  dynamicProps: string | SimpleExpressionNode | undefined // 动态属性
  directives: DirectiveArguments | undefined // 指令参数
  isComponent: boolean // 是否是组件
}

export interface TextCallNode extends Node {
  type: NodeTypes.TEXT_CALL
  content: TextNode | InterpolationNode | CompoundExpressionNode
  codegenNode: CallExpression | SimpleExpressionNode
}

// 创建复合表达式节点
export function createCompoundExpression(
  children: CompoundExpressionNode['children'],
): CompoundExpressionNode {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    children,
  }
}

// 创建简单表达式节点（isStatic 表示是否静态）
export function createSimpleExpression(content, isStatic = false): SimpleExpressionNode {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content,
    isStatic,
  }
}

// 用于创建数组表达式节点
export function createArrayExpression(elements): ArrayExpression {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    elements,
  }
}

// 用于创建函数调用表达式节点
export function createCallExpression(callee, _arguments): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    callee,
    arguments: _arguments,
  }
}

// 用于创建对象表达式节点
export function createObjectExpression(properties): ObjectExpression {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties,
  }
}

// 用于创建对象属性节点
export function createObjectProperty(key, value): Property {
  return {
    type: NodeTypes.JS_PROPERTY,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value,
  }
}

// 创建根节点
export function createRoot(children: TemplateChildNode[]): RootNode {
  return {
    type: NodeTypes.ROOT,
    helpers: [],
    children,
  }
}

// 创建虚拟节点调用
export function createVNodeCall(
  context: TransformContext | null,
  tag: VNodeCall['tag'],
  props?: VNodeCall['props'],
  children?: VNodeCall['children'],
  patchFlag?: VNodeCall['patchFlag'],
  dynamicProps?: VNodeCall['dynamicProps'],
  directives?: VNodeCall['directives'],
  isComponent: VNodeCall['isComponent'] = false,
): VNodeCall {
  if (context) {
    // 注入运行时帮助函数
    context.helper(CREATE_ELEMENT_VNODE)
  }
  return {
    type: NodeTypes.ELEMENT,
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isComponent,
  }
}
