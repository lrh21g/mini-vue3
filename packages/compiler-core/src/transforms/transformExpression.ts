import type { NodeTransform } from '../transform'
import { NodeTypes } from '../ast'

// 表达式转换器
export const transformExpression: NodeTransform = (node, _context) => {
  // 处理插值表达式节点（如：{{ message }}）
  if (node.type === NodeTypes.INTERPOLATION) {
    // 处理插值内容表达式（将 message 转换为 _ctx.message）
    node.content = processExpression(node.content)
  }
  // 处理元素节点（如：<div :class="cls"></div>）
  else if (node.type === NodeTypes.ELEMENT) {
    // 遍历元素的所有属性（props）
    node.props = node.props.map((prop) => {
      // 仅处理指令型属性（如 v-bind/v-model 等）
      if (prop.type === NodeTypes.DIRECTIVE) {
        // 获取指令的表达式节点
        const exp = prop.exp
        // 检查是否为动态简单表达式（非静态）
        if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.isStatic) {
          // 添加上下文前缀（如将 cls 转换为 _ctx.cls）
          exp.content = `_ctx.${exp.content}`
        }
      }
      // 返回处理后的属性
      return prop
    })
  }
}

// 表达式处理函数（添加上下文前缀）
function processExpression(node) {
  // 修改表达式内容（添加_ctx前缀）
  node.content = `_ctx.${node.content}`
  // 返回修改后的节点
  return node
}
