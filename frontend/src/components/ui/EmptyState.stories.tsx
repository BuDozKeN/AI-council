import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import { FileText, Search, MessageSquare, Clock } from 'lucide-react';
import { Button } from './button';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'No items found',
    message: 'Try adjusting your search or filters.',
  },
};

export const WithCustomIcon: Story = {
  args: {
    icon: FileText,
    title: 'No documents',
    message: 'Upload your first document to get started.',
    action: <Button size="sm">Upload Document</Button>,
  },
};

export const SearchEmpty: Story = {
  args: {
    icon: Search,
    title: 'No results',
    message: 'No decisions match your search criteria.',
  },
};

export const LargeWelcome: Story = {
  args: {
    variant: 'large',
    icon: MessageSquare,
    title: 'Welcome to AxCouncil',
    message: 'Ask your AI council a question to get started.',
    hints: ['Try: "What authentication strategy should we use?"', 'Or: "Review our pricing model"'],
  },
};

export const WithHintsAndAction: Story = {
  args: {
    variant: 'large',
    icon: Clock,
    title: 'No recent activity',
    message: 'Start a new council session to see activity here.',
    hints: ['Sessions are saved automatically', 'Access history from the sidebar'],
    action: <Button>New Session</Button>,
  },
};
