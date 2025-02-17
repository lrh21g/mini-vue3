import type { ElementNode, ParserOptions } from '@mini-vue3/compiler-core'
import { TextModes } from '@mini-vue3/compiler-core'
import { isHTMLTag, isVoidTag, makeMap } from '@mini-vue3/shared'
import { decodeHtml } from './decodeHtml_'

const isRawTextContainer = makeMap('style,iframe,script,noscript')

export const parserOptions: ParserOptions = {
  isVoidTag,
  isNativeTag: tag => isHTMLTag(tag),
  whitespace: 'preserve',
  decodeEntities: decodeHtml,
  getTextMode({ tag }: ElementNode): TextModes {
    if (tag === 'textarea' || tag === 'title') {
      return TextModes.RCDATA
    }

    if (isRawTextContainer(tag)) {
      return TextModes.RAWTEXT
    }
    return TextModes.DATA
  },
}
