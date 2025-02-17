import { camelize, toHandlerKey } from '@mini-vue3/shared'
import { createObjectProperty, createSimpleExpression, NodeTypes } from '../ast'

// v-on指令转换器
export function transformOn(dir) {
  // 解构指令参数（事件名称）
  const { arg } = dir

  let eventName // 处理后的事件名

  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    // 静态事件名（如@click）
    if (arg.isStatic) {
      // 原始事件名（如"click"）
      const rawName = arg.content
      // 驼峰化并添加 'on' 前缀（click → onClick）
      eventName = createSimpleExpression(
        toHandlerKey(camelize(rawName)), // 转换为onClick格式
        true, // 标记为静态
      )
    }
    // 动态事件名（如@[event]）
    else {
      // TODO 将动态的事件名处理成组合表达式
    }
  }
  // 复合表达式参数（非常用情况）
  else {
    eventName = arg // 直接使用原始参数
  }

  // 处理表达式
  let exp = dir.exp // 获取表达式（如@click="handler"）
  // 空表达式处理
  if (exp && !exp.content.trim()) {
    exp = undefined // 清除无效表达式
  }

  // 构造返回结果
  const ret = {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression('() => {}', false),
      ),
    ],
  }

  return ret
}
