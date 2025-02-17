import type { TextModes } from './parse'
import type { NodeTransform } from './transform'

// 用于配置模板解析器的行为
export interface ParserOptions {
  // 用于判断给定的标签名是否是自闭合标签
  isVoidTag?: (str: string) => boolean
  // 用于判断给定的标签名是否是原生 HTML 标签
  isNativeTag?: (str: string) => boolean
  // 用于获取节点的文本模式
  getTextMode?: (node, parent) => TextModes
  // 一个包含开始和结束定界符的数组，用于自定义模板中的插值语法： ['{{', '}}']
  delimiters?: [string, string]
  // 用于解码实体字符
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  // 指定如何处理空白字符：condense - 压缩空白字符； preserve - 不压缩
  whitespace?: 'preserve' | 'condense'
  // 用于是否删除注释节点
  comments?: boolean
}

// 用于配置模板转换器的行为
export interface TransformOptions {
  // 一个节点转换函数的数组，用于在转换过程中处理节点
  nodeTransforms?: NodeTransform[]
  // 用于自定义指令的转换行为
  directiveTransforms?: object
}

// 用于配置代码生成器的行为
export interface CodegenOptions {
  // 指定代码生成的模式
  // 在 module 模式下，默认为严格模式，不能使用 with 语句
  // e.g. {{ foo }} 在 module 模式下生成的代码为 _ctx.foo ，在 function 模式下是 with (this) { ... }
  mode?: 'module' | 'function'
  // 是否为生成的代码添加前缀
  prefixIdentifiers?: boolean
  // 指定运行时模块的名称
  runtimeModuleName?: string
  // 指定全局运行时名称
  runtimeGlobalName?: string
}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions
