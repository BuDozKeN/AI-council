import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'e2e/**',
        // Admin portal - new feature, tests to be added later
        'src/components/admin/**',
      ],
      thresholds: {
        // Minimum coverage thresholds - incrementally increase to 70%
        // Current: ~27% lines, ~19% branches, ~24% functions
        // Target: Increase 5% per sprint
        lines: 25,
        branches: 15,
        functions: 20,
        statements: 25,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
