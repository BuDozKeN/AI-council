import type { Meta, StoryObj } from '@storybook/react';
import { ErrorState } from './ErrorState';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

// Minimal i18n setup for stories
const i18nInstance = i18n.createInstance();
i18nInstance.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'errors.generic': 'Something went wrong',
        'common.tryAgain': 'Try Again',
      },
    },
  },
});

const meta: Meta<typeof ErrorState> = {
  title: 'UI/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18nInstance}>
        <Story />
      </I18nextProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: {},
};

export const WithMessage: Story = {
  args: {
    title: 'Connection Failed',
    message: 'Unable to reach the server. Please check your internet connection.',
  },
};

export const WithRetry: Story = {
  args: {
    title: 'Failed to load decisions',
    message: 'The council pipeline encountered an error.',
    onRetry: () => alert('Retrying...'),
  },
};

export const CustomRetryLabel: Story = {
  args: {
    title: 'Session Expired',
    message: 'Your session has timed out.',
    onRetry: () => alert('Refreshing...'),
    retryLabel: 'Refresh Session',
  },
};
