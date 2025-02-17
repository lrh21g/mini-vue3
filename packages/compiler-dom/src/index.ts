import type { CompilerOptions, ParserOptions } from '@mini-vue3/compiler-core'
import { baseCompile, baseParse } from '@mini-vue3/compiler-core'
import { extend } from '@mini-vue3/shared'
import { parserOptions } from './parserOption'

export { parserOptions }

export function parse(
  template: string,
  options: ParserOptions = {},
) {
  return baseParse(
    template,
    extend(
      {},
      parserOptions,
      options,
      {
        // 扩展 options
      },
    ),
  )
}

export function compile(
  template: string,
  options: CompilerOptions,
) {
  return baseCompile(
    template,
    extend(
      {},
      parserOptions,
      options,
      {
      // 扩展 options
      },
    ),
  )
}

export * from '@mini-vue3/compiler-core'
