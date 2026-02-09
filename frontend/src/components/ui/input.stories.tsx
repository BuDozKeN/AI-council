import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'search', 'number', 'url'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
};

export const Email: Story = {
  args: { type: 'email', placeholder: 'you@example.com' },
};

export const Password: Story = {
  args: { type: 'password', placeholder: 'Enter password' },
};

export const Search: Story = {
  args: { type: 'search', placeholder: 'Search decisions...' },
};

export const Disabled: Story = {
  args: { placeholder: 'Cannot edit', disabled: true },
};

export const WithValue: Story = {
  args: { defaultValue: 'Pre-filled content' },
};

/** Input with label for accessibility testing */
export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <label htmlFor="email-input" className="text-sm font-medium">
        Email Address
      </label>
      <Input id="email-input" type="email" placeholder="you@example.com" />
    </div>
  ),
};
