import stripRTL from './postcss-strip-rtl.js';

export default {
  plugins: [
    '@tailwindcss/postcss',
    // Strip RTL language selectors to reduce bundle size by ~400KB
    // Tailwind v4 adds :lang() pseudo-classes for 19 RTL languages which we don't need
    stripRTL,
  ],
}
