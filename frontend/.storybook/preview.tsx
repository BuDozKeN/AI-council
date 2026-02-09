import type { Preview } from '@storybook/react';

// Import global styles so stories render with correct theming
import '../src/styles/design-tokens.css';
import '../src/index.css';
import '../src/styles/tailwind.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Accessibility addon defaults
    a11y: {
      config: {
        rules: [
          // WCAG 2.1 AA by default
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
    },
    // Viewport presets matching your Playwright config
    viewport: {
      viewports: {
        mobile: { name: 'iPhone 14', styles: { width: '390px', height: '844px' } },
        mobileSE: { name: 'iPhone SE', styles: { width: '320px', height: '568px' } },
        tablet: { name: 'iPad Pro 11', styles: { width: '834px', height: '1194px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '720px' } },
        desktopWide: { name: 'Desktop Wide', styles: { width: '1440px', height: '900px' } },
      },
    },
    // Disable animations for consistent screenshots
    chromatic: {
      disableSnapshot: false,
    },
  },
  // Global decorators for theming
  decorators: [
    (Story) => (
      <div className="font-sans antialiased">
        <Story />
      </div>
    ),
  ],
  // Dark mode toggle via toolbar
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
