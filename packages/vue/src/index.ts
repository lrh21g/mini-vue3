/* eslint-disable no-new-func */
import type { CompilerOptions } from '@mini-vue3/compiler-dom'
import { compile } from '@mini-vue3/compiler-dom'
import * as runtimeDom from '@mini-vue3/runtime-dom'
import { registerRuntimeCompiler } from '@mini-vue3/runtime-dom'
import { isString } from '@mini-vue3/shared'

function compileToFunction(
  template: string | HTMLElement, //  模板内容，可以是字符串、DOM 元素（如 <div>）
  options: CompilerOptions, // 编译器配置
  isGlobal: boolean = true, // 是否在全局作用域下生成渲染函数
) {
  // 如果 template 是 DOM 元素（如 <div>），提取其 innerHTML 作为模板字符串
  if (!isString(template)) {
    template = template.innerHTML // 提取 DOM 元素的 innerHTML
  }

  // 如果 template 以 # 开头（如 #app），将其视为 CSS 选择器，查找对应的 DOM 元素并提取 innerHTML
  if (template[0] === '#') {
    const el = document.querySelector(template)

    if (!el) {
      console.warn('没有找到当前的元素')
    }

    template = el ? el.innerHTML : ''
  }

  // 调用 Vue 的核心编译器 compile，将模板字符串编译为渲染函数的代码字符串
  const { code } = compile(template, options)

  const render = isGlobal
    // 假设 createVNode 等函数已挂载到全局（如通过 <script> 引入 Vue 全局构建版本）,直接通过 new Function(code)() 执行代码，生成 render 函数。
    ? new Function(code)()
    // 通过参数注入 MiniVue3（即运行时工具集 runtimeDom），避免污染全局作用域，适用于按需引入的模块化构建（如通过 import { createVNode } from 'vue'）。
    : new Function('MiniVue3', code)(runtimeDom)

  return render
}

registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }

export * from '@mini-vue3/runtime-dom'
export * from '@mini-vue3/server-renderer'
