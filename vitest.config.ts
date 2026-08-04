import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'components/**/*.test.ts',
      'crm/**/*.test.ts',
      'server/**/*.test.ts',
      'lib/**/*.test.ts',
      'tests/**/*.test.ts',
      'scripts/**/*.test.ts',
      'platform/**/*.test.ts',
      'modules/**/*.test.ts',
    ],
  },
})
