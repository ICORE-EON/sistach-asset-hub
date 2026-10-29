/** Runs the extracted export alone, without app wiring or standalone tests. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/modules/maintenance/**/__tests__/**/*.test.ts'], environment: 'node' },
});