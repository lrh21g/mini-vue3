/* eslint-disable regexp/no-useless-flag */
/* eslint-disable regexp/no-useless-escape */
/* eslint-disable regexp/no-unused-capturing-group */
/* eslint-disable regexp/prefer-character-class */
/* eslint-disable regexp/no-misleading-capturing-group */
/* eslint-disable regexp/no-super-linear-backtracking */
import type {
  AttributeNode,
  CommentNode,
  DirectiveNode,
  ElementNode,
  InterpolationNode,
  TemplateChildNode,
  TextNode,
} from './ast'
import type { ParserOptions } from './options'
import { extend, isArray } from '@mini-vue3/shared'
import {
  createRoot,
  ElementTypes,
  NodeTypes,
} from './ast'

// 标签类型
enum TagType {
  Start, // 开始标签。 e.g. <div>
  End, // 结束标签。 e.g. </div>
}

// 定义了不同的文本模式，用于在解析模板时确定文本内容的处理方式
export enum TextModes {
  //              | 是否解析标签 | 是否支持解析HTML实体
  // DATA, //     |    ✔       |     ✔
  // RCDATA, //   |    ✘       |     ✔
  // RAWTEXT, //  |    ✘       |     ✘
  // CDATA, //    |    ✘       |     ✘
  DATA, // 常规文本模式，用于处理普通的 HTML 内容
  RCDATA, // HTML 中的可解析字符数据，处理 <script>、<style> 等标签中的内容
  RAWTEXT, // 原始文本模式，处理 <textarea> 等标签中的内容，不会被 HTML 解析器进一步转义
  CDATA, // CDATA 文本模式，通常用于处理 XML 中的 CDATA 段，文本内容会被当作原始数据，不进行解析
  ATTRIBUTE_VALUE, // 属性值文本模式，用于处理标签属性的值。（如 <div id="test"> 中的 id="test"）
}

// HTML 属性的内容和属性值的格式（是否带引号）
interface AttributeValue {
  content: string // 属性的实际内容（如 id="test" 中的 test）
  isQuoted: boolean // 表示属性值是否被引号（" 或 '）包围
}

// 解析器的上下文
export interface ParserContext {
  options: ParserOptions // 解析器的配置选项
  source: string // 当前正在解析的源字符串，表示待解析的模板或 HTML
}

// 解析器的默认选项
const defaultParserOptions: ParserOptions = {
  delimiters: ['{{', '}}'], // 模板中插值表达式的定界符。表示模板中的插值表达式将被包裹在 {{ 和 }} 之间，例如 {{ message }}
  getTextMode: () => TextModes.DATA, // 解析器在解析文本时使用的默认模式。默认为 TextModes.DATA，即常规的文本模式
}

// 用于创建解析器的上下文
function createParseContext(
  content: string, // 待解析的模板字符串
  rawOptions?: ParserOptions, // 可选的解析选项
): ParserContext {
  // 初始化解析选项
  const options = extend({}, defaultParserOptions)

  // 合并用户提供的选项
  for (const key in rawOptions) {
    options[key] = rawOptions[key] === undefined
      ? defaultParserOptions[key]
      : rawOptions[key]
  }

  return {
    options,
    source: content,
  }
}

// 模板解析函数
export function baseParse(
  content: string,
  options: ParserOptions = {},
) {
  // 创建解析上下文
  const context = createParseContext(content, options)
  // 递归解析子节点
  const children = parseChildren(context, TextModes.DATA, [])
  // 生成根节点
  return createRoot(children)
}

// 用于解析模板中的子节点
function parseChildren(
  context: ParserContext, // 解析上下文
  mode: TextModes, // 文本解析模式（DATA/RCDATA/RAWTEXT等）
  ancestors: ElementNode[], // 祖先元素栈（用于处理嵌套标签）
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  // 主解析循环：持续解析直到遇到结束条件
  // 通过 isEnd 判断是否达到了模板的结束位置
  while (!isEnd(context, ancestors)) {
    // 当前剩余待解析的模板字符串
    const s = context.source
    // 存储当前解析后的节点
    let node!: TemplateChildNode | TemplateChildNode[]

    // DATA 模式和 RCDATA 模式才支持插值内容的解析
    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      // 检测是否为 DATA 模式（只有 DATA 模式才支持标签解析），并且判断标签起始符 '<'
      if (mode === TextModes.DATA && s[0] === '<') {
        // 处理开始标签 '<!'
        if (s[1] === '!') {
          // 解析注释节点
          if (startsWith(s, '<!--')) {
            node = parseComment(context)
          }
          // 解析 CDATA 节点（仅限 XML 风格）
          else if (startsWith(s, '<![CDATA][')) {
            node = parseCDATA(context)
          }
        }
        // 处理结束标签 '</'
        else if (s[1] === '/') {
          // 错误处理：无效的结束标签

          // 字符串结束于 '</'
          if (s.length === 2) {
            advanceBy(context, 2)
            console.error('</')
            continue
          }
          // 无效的闭合 '</>'
          else if (s[2] === '>') {
            advanceBy(context, 3)
            console.error('</>')
            continue
          }
          // 检测到合法结束标签（但当前不应出现在子节点解析中）
          else if (/[a-z]/i.test(s[2])) {
            const element = parseTag(context, TagType.End)
            console.error('无效标签', element.tag)
            continue
          }
        }
        // 处理元素标签（如 <div>）
        else if (/[a-z]/i.test(s[1])) {
          // 解析元素节点（递归调用 parseChildren）
          node = parseElement(context, ancestors)
        }
      }
      // 处理插值语法（如 {{ value }}）
      else if (context.options.delimiters && startsWith(s, context.options.delimiters[0])) {
        node = parseInterpolation(context, mode)
      }
    }

    // 如果没有匹配到其他节点类型（如注释、元素等），调用 parseText 解析文本节点
    if (!node) {
      node = parseText(context, mode)
    }

    // 如果解析得到的节点是一个数组（如插值表达式可能产生多个节点），则将每个节点都推入 nodes 数组中；
    // 否则，直接推入单个节点。
    if (isArray(node)) {
      node.forEach(n => pushNode(nodes, n))
    }
    else {
      pushNode(nodes, node)
    }
  }

  // 标记是否移除了空白节点
  let removedWhitespace = false
  // 判断是否需要压缩空白字符
  const shouldCondense = context.options.whitespace !== 'preserve'

  // 处理空白节点
  // 如果节点是文本节点，且只包含空白字符（如空格、制表符、换行符），根据 shouldCondense 来决定是否移除或压缩空白节点。
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === NodeTypes.TEXT) {
      // 检测纯空白文本节点
      if (!/[^\t\r\n\f ]/.test(node.content)) {
        const prev = nodes[i - 1]
        const next = nodes[i + 1]
        if (
          !prev
          || !next
          || (
            shouldCondense
            && (
              prev.type === NodeTypes.COMMENT
              || next.type === NodeTypes.COMMENT
              || (prev.type === NodeTypes.ELEMENT
                && next.type === NodeTypes.ELEMENT
                && /[\r\n]/.test(node.content))
            )
          )
        ) {
          removedWhitespace = true
          nodes[i] = null as any
        }
        // 文本中部分空白，将空白节点压缩成一个空格的节点
        else {
          node.content = ' '
        }
      }
      else if (shouldCondense) {
        // 将多个空格将压缩成一个空格
        node.content = node.content.replace(/[\t\r\n\f ]+/g, ' ')
      }
    }
  }

  // 返回节点数组
  // 如果移除了空白节点，则使用 filter(Boolean) 去除 null 值；
  // 否则，直接返回所有节点
  return removedWhitespace ? nodes.filter(Boolean) : nodes
}

// 用于解析模版中的 HTML 元素节点
function parseElement(
  context: ParserContext, // 解析上下文
  ancestors: ElementNode[],
): ElementNode {
  // 调用 parseTag 方法解析开始标签，生成一个 ElementNode 对象
  const element = parseTag(context, TagType.Start)

  // 如果元素是自闭合标签（如 <img />），或者是用户配置的无内容标签（例如 <br>、<input> 等），则直接返回该元素，不再解析其子节点。
  if (element.isSelfClosing || (context.options.isVoidTag && context.options.isVoidTag(element.tag)))
    return element

  // 将当前元素添加到祖先节点数组中，这样在解析子节点时能明确其父节点信息。
  ancestors.push(element)

  // 根据当前元素和上下文确定文本解析模式。
  const mode = context.options.getTextMode && context.options.getTextMode(element, context)
  // 调用 parseChildren 函数（前面已有解释），传入解析上下文、文本解析模式和祖先节点数组，解析当前元素的子节点
  element.children = parseChildren(context, mode!, ancestors)
  // 将当前元素从祖先节点数组中移除，确保在解析完当前元素及其子节点后，祖先节点数组恢复到正确状态，以便继续解析后续元素。
  ancestors.pop()

  // 检查当前待解析的源字符串是否以当前元素的结束标签开头
  if (startsWith(context.source, `</${element.tag}`)) {
    // 解析结束标签
    parseTag(context, TagType.End)
  }
  else {
    console.error(`${element.tag} 标签缺少闭合标签`)
  }

  return element
}

// 用于解析 HTML 或 XML 中的注释节点
function parseComment(
  context: ParserContext,
): CommentNode {
  // 更新解析上下文 context，使其指针移动到注释内容的起始位置
  advanceBy(context, '<!--'.length)

  // 查找注释结束标记
  const closeIndex = context.source.indexOf('-->')

  if (closeIndex < 0) {
    console.error('注释无结束符')
  }

  // 提取注释内容
  const content = context.source.slice(0, closeIndex)
  advanceBy(context, content.length)
  advanceBy(context, '-->'.length)

  return {
    type: NodeTypes.COMMENT,
    content,
  }
}

function parseCDATA(
  _context: ParserContext,
): TemplateChildNode[] {
  // TODO CDATA和普通文本一样不解析实体不支持解析标签
  return []
}

// 用于解析模板中的插值表达式
function parseInterpolation(
  context: ParserContext,
  mode: TextModes,
): InterpolationNode {
  // 获取插值表达式的分隔符
  const [open, close] = context.options.delimiters!

  advanceBy(context, open.length)

  // 查找插值表达式结束分隔符的位置
  const closeIndex = context.source.indexOf(close)
  if (closeIndex < 0) {
    console.warn('没有结束定界符', close)
  }

  // 提取插值表达式内容并去除首尾空格
  const preTrimContent = parseTextData(context, closeIndex, mode)
  const content = preTrimContent!.trim()
  advanceBy(context, close.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content,
      isStatic: false,
    },
  }
}

// 用于解析模板中的文本节点
function parseText(
  context: ParserContext,
  mode: TextModes,
): TextNode {
  // 定义一个包含可能结束文本节点的标记的数组
  // > 如果遇到 '<' 的开始，表示文本结束
  // > 如果配置了插值表达式的分隔符，遇到分隔符的起始符也表示文本结束
  const endTokens = ['<', context.options.delimiters && context.options.delimiters[0]]
  // 初始化 endIndex 为源字符串的长度，表示默认情况下文本节点延续到字符串的末尾
  let endIndex = context.source.length
  // 查找最早的结束标记
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i]!, 1)
    if (index !== -1 && index < endIndex) {
      endIndex = index
    }
  }

  // 提取文本内容
  const content = parseTextData(
    context,
    endIndex,
    mode,
  )!
  return {
    type: NodeTypes.TEXT,
    content,
  }
}

// 用于解析 HTML 或 XML 标签
function parseTag(
  context: ParserContext,
  type: TagType,
): ElementNode {
  // 使用正则表达式匹配标签的开始部分和标签名
  const s = context.source
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(s)!
  const tag = match[1]

  // 更新解析上下文 context，使其指针移动到标签名后的第一个非空白字符位置
  advanceBy(context, match[0].length)
  advanceSpaces(context)

  // 解析标签的属性
  const props = parseAttributes(context, type)

  // 更新解析上下文 context，使其指针移动到标签结束部分
  const isSelfClosing = startsWith(s, '/>')
  advanceBy(context, isSelfClosing ? 2 : 1)

  // 处理结束标签
  if (type === TagType.End) {
    return undefined as any
  }

  const tagType = ElementTypes.ELEMENT
  // TODO 此处,还会判断当前 Element 是否是 Component、template、slot,具体根据 tag 值来区分
  return {
    type: NodeTypes.ELEMENT,
    tag,
    props,
    children: [],
    isSelfClosing,
    codegenNode: undefined as any,
    tagType,
  }
}

// 解析 HTML 标签中的所有属性（包含属性、指令）
function parseAttributes(
  context: ParserContext,
  type: TagType,
): (AttributeNode | DirectiveNode)[] {
  // 存储解析后的属性节点或指令节点
  const props: any = []
  // 存储已经解析过的属性名称，检测重复属性
  const attributeNames = new Set<string>()

  // 循环解析直到遇到 '>' 或 '/>' 结束
  while (
    context.source.length > 0
    && !startsWith(context.source, '>')
    && !startsWith(context.source, '/>')
  ) {
    if (type === TagType.End) {
      console.error('结束标签不允许拥有属性')
    }

    // 解析单个属性
    const attr = parseAttribute(context, attributeNames)

    // 处理 class 属性值，进行空白字符规范化
    // class=" foo bar " => "foo bar"
    if (
      attr.type === NodeTypes.ATTRIBUTE
      && attr.name === 'class'
      && attr.value
    ) {
      attr.value.content = attr.value.content.replace(/\s+/g, ' ').trim()
    }

    if (type === TagType.Start) {
      props.push(attr)
    }

    // 检测属性间缺少空格的情况（如 id"app"）
    if (/^[^\t\r\n\f />]/.test(context.source)) {
      console.error('属性之间缺少空格')
    }
    advanceSpaces(context)
  }
  return props
}

// 解析单个属性，区分普通属性和指令
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  const match = /^[^\t\n\r\f />][^\t\n\r\f />=]*/.exec(context.source)!
  const name = match[0]

  // 检查属性名称是否重复
  if (nameSet.has(name)) {
    console.error('属性重复')
  }
  nameSet.add(name)

  // TODO 属性不允许有特殊字符、= '"<
  // if (name[0] === '=') {
  //   console.error('属性名前的意外等号')
  // }
  // {
  //   const pattern = /['"<]/g
  //   let match
  //   if((match = pattern.exec(name))) {
  //     console.log('name中出现意外字符', match[0])
  //   }
  // }

  advanceBy(context, name.length)

  let value!: AttributeValue
  // 处理属性值（以等号（可能前面有空格）开头，则表示有属性值）
  if (/^[\n\t\f ]*=/.test(context.source)) {
    advanceSpaces(context)
    advanceBy(context, 1)
    advanceSpaces(context)

    // 解析属性值
    value = parseAttributeValue(context)
    if (!value) {
      console.error('属性', name, '缺少属性值')
    }
  }

  // 处理指令（以 v-、:、.、@ 或 # 开头，则认为是指令）
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match
      = /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(name)!

    const isPropShorthand = startsWith(name, '.')
    // 根据不同的前缀确定指令名称（如 : 对应 bind，@ 对应 on）
    const dirName
      = match[1]
      || (isPropShorthand || startsWith(name, ':')
        ? 'bind'
        : startsWith(name, '@')
          ? 'on'
          : '')

    // 处理动态参数（如 : <a :[attributeName]="url"> ... </a>）
    let arg
    if (match[2]) {
      let content = match[2]
      let isStatic = true
      if (content.startsWith('[')) {
        isStatic = false
        if (content.endsWith(']')) {
          content = content.slice(1, content.length - 1)
        }
      }
      arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content,
        isStatic,
      }
    }

    // 处理修饰符（如 .stop.prevent）
    const modifiers = match[3] ? match[3].slice(1).split('.') : []
    if (isPropShorthand)
      modifiers.push('prop')

    // 构造指令节点
    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
      },
      arg,
      modifiers,
    }
  }

  // 普通属性节点
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
    },
  }
}

// 解析属性值内容，支持带引号和不带引号的写法
function parseAttributeValue(context: ParserContext): AttributeValue {
  let content
  const quoted = context.source[0]
  const isQuoted = quoted === `'` || quoted === `"`

  // 处理有引号的属性值（如 < name="xx" >）
  if (isQuoted) {
    // 跳过起始引号
    advanceBy(context, 1)

    // 获取引号的结束位置
    const endIndex = context.source.indexOf(quoted)
    // 没有找到结束引号，则输出错误信息，并解析到源文本的末尾
    if (endIndex === -1) {
      console.error(`属性不存在结束的引号`)

      // 解析剩余所有内容
      content = parseTextData(
        context,
        context.source.length,
        TextModes.ATTRIBUTE_VALUE,
      )
    }
    // 找到结束引号，解析引号间内容，并跳过结束引号
    else {
      // 解析引号间内容
      content = parseTextData(
        context,
        endIndex,
        TextModes.ATTRIBUTE_VALUE,
      )
      // 跳过结束引号
      advanceBy(context, 1)
    }
  }
  // 处理无引号的属性值（如  < name =xx >）
  else {
    // 匹配无引号的属性值
    const match = /^[^\n\t\f\r >]+/.exec(context.source)
    if (!match) {
      return undefined as any
    }

    // 检查属性值中是否包含不合法字符（如 "、'、<、=、`）
    const unexpectedChars = /["'<=`]/g
    if (unexpectedChars.test(match[1])) {
      console.error('当前的值不合法')
    }

    // 解析无引号的属性值
    content = parseTextData(
      context,
      match[0].length,
      TextModes.ATTRIBUTE_VALUE,
    )
  }

  return {
    content,
    isQuoted,
  }
}

// 解析模板中的文本数据。根据不同的文本模式（TextModes）对提取的文本进行处理
function parseTextData(
  context: ParserContext, // 解析上下文对象，包含了解析所需的配置选项和待解析的源文本
  length: number, // 从源文本中提取的文本长度
  mode: TextModes, // 当前的文本模式，用于确定解析规则
) {
  // 从当前源文本的开头截取长度为 length 的文本
  const rawText = context.source.slice(0, length)

  advanceBy(context, length)

  // 根据模式处理文本
  // > 如果当前模式是 RAWTEXT 或 CDATA，直接返回原始文本。
  // > 如果原始文本中不包含 & 字符，也直接返回原始文本。
  // 在这些情况下，文本不需要进行实体解码
  if (
    mode === TextModes.RAWTEXT
    || mode === TextModes.CDATA
    || !rawText.includes('&')
  ) {
    return rawText
  }
  // 解码 HTML 实体
  else {
    return context.options.decodeEntities && context.options.decodeEntities(
      rawText,
      mode === TextModes.ATTRIBUTE_VALUE,
    )
  }
}

// 判断模板解析是否到达结束状态
function isEnd(
  context: ParserContext,
  ancestors: ElementNode[],
) {
  const s = context.source

  // 如果源文本为空（即 s 为 null、undefined 或空字符串），说明已经解析完所有内容
  if (!s)
    return true

  // 遍历 ancestors 列表，从最后一个祖先节点开始向前检查
  // 检查是否遇到祖先节点的结束标签
  for (let i = ancestors.length - 1; i >= 0; --i) {
    if (startsWith(s, `</${ancestors[i].tag}`)) {
      return true
    }
  }
  return !s
}

// 消费指定数量的字符，更新解析上下文中的剩余模板字符串
// e.g. '<div>Hello</div>' => advanceBy(context, 5) => '>Hello</div>'
function advanceBy(context: ParserContext, numberOfCharacters: number) {
  context.source = context.source.slice(numberOfCharacters)
}

// 消费连续的空白字符（包括换行符、制表符等），更新解析上下文中的剩余模板字符串
// e.g. '<div class="container">'
// parseTag(context) => 消费 "<div"
// advanceSpaces(context) => 跳过 " class=" 前的空格
function advanceSpaces(context: ParserContext) {
  const { source } = context
  const match = /^[\t\n\r\f ]+/.exec(source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString)
}

function pushNode(nodes: TemplateChildNode[], node: TemplateChildNode) {
  nodes.push(node)
}
