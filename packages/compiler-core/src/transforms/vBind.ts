import { createObjectProperty, createSimpleExpression, NodeTypes } from '../ast'

// v-bind
export function transformBind(dir) {
  // 解构表达式和修饰符
  const { exp, modifiers } = dir
  // 获取指令参数（绑定的属性名）
  const arg = dir.arg

  // 处理动态参数语法（当参数为复杂表达式时）
  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    // 添加括号和空值回退，如将 arg 转换为 (arg) || ""
    arg.children.unshift('(')
    arg.children.push(') || ""')
  }
  // 动态简单表达式
  else if (!arg.isStatic) {
    // 添加空值回退，如 arg => arg || ""
    arg.content = `${arg.content} || ""`
  }

  // 处理.prop修饰符（属性绑定）
  if (modifiers.includes('prop')) {
    // 添加.前缀，如 :foo.prop → .foo
    injectPrefix(arg, '.')
  }
  // 处理.attr修饰符（HTML特性绑定）
  if (modifiers.includes('attr')) {
    // 添加^前缀，如:foo.attr → ^foo
    injectPrefix(arg, '^')
  }

  // 处理无表达式情况（如v-bind:key）
  if (
    !exp
    || (exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim())
  ) {
    return {
      // 创建空字符串属性，如key=""
      props: [
        createObjectProperty(
          arg,
          createSimpleExpression('', true),
        ),
      ],
    }
  }

  return {
    props: [createObjectProperty(arg, exp)],
  }
}

// 前缀注入工具函数
function injectPrefix(arg, prefix) {
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    // 静态参数，直接拼接
    if (arg.isStatic) {
      arg.content = prefix + arg.content
    }
    // 动态参数
    // 使用模板字符串处理，如:foo → `.${foo}`
    else {
      arg.content = `\`${prefix}\${${arg.content}}\``
    }
  }
  // 复合表达式参数处理，确保动态参数始终返回字符串
  // e.g. :['foo' + bar] → ('foo' + bar) || ""
  else {
    arg.children.unshift(`'${prefix}' + (`)
    arg.children.push(`)`)
  }
}
