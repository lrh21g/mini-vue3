import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'packages',
      include: ['packages/**/*.test.{ts,js}'],
      exclude: [],
    },
  },
])
