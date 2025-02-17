/* eslint-disable ts/no-use-before-define */
import type { ParserOptions } from '@mini-vue3/compiler-core'
import namedCharacterReferences from './namedChars.json'

// lazy compute this to make this file tree-shakable for browser
let maxCRNameLength: number

export const decodeHtml: ParserOptions['decodeEntities'] = (
  rawText,
  asAttr,
) => {
  let offset = 0
  const end = rawText.length
  let decodedText = ''

  function advance(length: number) {
    offset += length
    rawText = rawText.slice(length)
  }

  while (offset < end) {
    const head = /&(?:#x?)?/i.exec(rawText)
    if (!head || offset + head.index >= end) {
      const remaining = end - offset
      decodedText += rawText.slice(0, remaining)
      advance(remaining)
      break
    }

    // Advance to the "&".
    decodedText += rawText.slice(0, head.index)
    advance(head.index)

    if (head[0] === '&') {
      // Named character reference.
      let name = ''
      let value: string | undefined
      if (/[0-9a-z]/i.test(rawText[1])) {
        if (!maxCRNameLength) {
          maxCRNameLength = Object.keys(namedCharacterReferences).reduce(
            (max, name) => Math.max(max, name.length),
            0,
          )
        }
        for (let length = maxCRNameLength; !value && length > 0; --length) {
          name = rawText.slice(1, 1 + length)
          value = (namedCharacterReferences as Record<string, string>)[name]
        }
        if (value) {
          const semi = name.endsWith(';')
          if (
            asAttr
            && !semi
            && /[=a-z0-9]/i.test(rawText[name.length + 1] || '')
          ) {
            decodedText += `&${name}`
            advance(1 + name.length)
          }
          else {
            decodedText += value
            advance(1 + name.length)
          }
        }
        else {
          decodedText += `&${name}`
          advance(1 + name.length)
        }
      }
      else {
        decodedText += '&'
        advance(1)
      }
    }
    else {
      // Numeric character reference.
      const hex = head[0] === '&#x'
      const pattern = hex ? /^&#x([0-9a-f]+);?/i : /^&#(\d+);?/
      const body = pattern.exec(rawText)
      if (!body) {
        decodedText += head[0]
        advance(head[0].length)
      }
      else {
        // https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
        let cp = Number.parseInt(body[1], hex ? 16 : 10)
        if (cp === 0) {
          cp = 0xFFFD
        }
        else if (cp > 0x10FFFF) {
          cp = 0xFFFD
        }
        else if (cp >= 0xD800 && cp <= 0xDFFF) {
          cp = 0xFFFD
        }
        else if ((cp >= 0xFDD0 && cp <= 0xFDEF) || (cp & 0xFFFE) === 0xFFFE) {
          // noop
        }
        else if (
          (cp >= 0x01 && cp <= 0x08)
          || cp === 0x0B
          || (cp >= 0x0D && cp <= 0x1F)
          || (cp >= 0x7F && cp <= 0x9F)
        ) {
          cp = CCR_REPLACEMENTS[cp] || cp
        }
        decodedText += String.fromCodePoint(cp)
        advance(body[0].length)
      }
    }
  }
  return decodedText
}

// https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
const CCR_REPLACEMENTS: Record<number, number | undefined> = {
  0x80: 0x20AC,
  0x82: 0x201A,
  0x83: 0x0192,
  0x84: 0x201E,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02C6,
  0x89: 0x2030,
  0x8A: 0x0160,
  0x8B: 0x2039,
  0x8C: 0x0152,
  0x8E: 0x017D,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201C,
  0x94: 0x201D,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02DC,
  0x99: 0x2122,
  0x9A: 0x0161,
  0x9B: 0x203A,
  0x9C: 0x0153,
  0x9E: 0x017E,
  0x9F: 0x0178,
}
