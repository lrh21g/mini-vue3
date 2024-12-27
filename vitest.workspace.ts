import path from 'node:path'
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      globals: true,
      include: ['packages/**/*.test.{ts,js}'],
    },
    resolve: {
      alias: [
        {
          find: /@mini-vue3\/([\w-]*)/,
          replacement: `${path.resolve(__dirname, 'packages')}/$1/src`,
        },
      ],
    },
  },
])
