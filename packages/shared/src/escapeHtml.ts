// 匹配需要转义的字符：双引号、单引号、&、<、>
const escapeRE = /["'&<>]/

// HTML 特殊字符转义
// 防止 XSS 攻击，确保用户输入的内容在渲染为 HTML 时，特殊字符被转义为实体
export function escapeHtml(string: unknown): string {
  // 强制转换为字符串（包括 null/undefined 会变成 "null"/"undefined"）
  const str = `${string}`
  const match = escapeRE.exec(str)

  // 无特殊字符直接返回
  if (!match) {
    return str
  }

  let html = '' // 结果缓冲区
  let escaped: string // 转义后的字符
  let index: number // 当前处理的字符位置
  let lastIndex = 0 // 上一次处理的结束位置
  // 遍历字符串，从第一个匹配位置开始
  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escaped = '&quot;'
        break
      case 38: // &
        escaped = '&amp;'
        break
      case 39: // '
        escaped = '&#39;'
        break
      case 60: // <
        escaped = '&lt;'
        break
      case 62: // >
        escaped = '&gt;'
        break
      default:
        continue
    }

    // 将上一个匹配位置到当前字符之间的普通内容拼接
    if (lastIndex !== index) {
      html += str.slice(lastIndex, index)
    }

    lastIndex = index + 1 // 更新处理位置
    html += escaped // 追加转义后的字符
  }

  // 拼接剩余未处理内容（如最后一个特殊字符后的部分）
  return lastIndex !== index ? html + str.slice(lastIndex, index) : html
}

// 匹配注释边界符号（防止注入非法内容）
// https://www.w3.org/TR/html52/syntax.html#comments
const commentStripRE = /^-?>|<!--|-->|--!>|<!-$/g
// HTML 注释净化
export function escapeHtmlComment(src: string): string {
  return src.replace(commentStripRE, '')
}

// 匹配 CSS 变量名中需要转义的符号（空格、引号、括号等）
export const cssVarNameEscapeSymbolsRE: RegExp = /[ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g
// CSS 变量名转义
export function getEscapedCssVarName(
  key: string,
  doubleEscape: boolean, // 是否双重转义（针对内联样式）
): string {
  return key.replace(cssVarNameEscapeSymbolsRE, s =>
    doubleEscape
      ? (s === '"' ? '\\\\\\"' : `\\\\${s}`) // 内联样式需要双重转义
      : `\\${s}`) // 普通 CSS 单层转义
}
