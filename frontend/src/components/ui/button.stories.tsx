import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Mail, Plus, Trash2, Check, Settings } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'success', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'icon'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Button' },
};

/** Alias for Default - the primary button style */
export const Primary: Story = {
  args: { children: 'Primary', variant: 'default' },
};

export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
};

export const Outline: Story = {
  args: { children: 'Outline', variant: 'outline' },
};

export const Ghost: Story = {
  args: { children: 'Ghost', variant: 'ghost' },
};

export const Destructive: Story = {
  args: { children: 'Delete Account', variant: 'destructive' },
};

export const Success: Story = {
  args: { children: 'Confirmed', variant: 'success' },
};

export const Link: Story = {
  args: { children: 'Learn more', variant: 'link' },
};

export const Small: Story = {
  args: { children: 'Small', size: 'sm' },
};

export const Large: Story = {
  args: { children: 'Large Button', size: 'lg' },
};

export const Icon: Story = {
  args: { size: 'icon', children: <Settings size={18} />, 'aria-label': 'Settings' },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail size={16} /> Send Email
      </>
    ),
  },
};

export const Loading: Story = {
  args: { children: 'Submitting...', loading: true },
};

export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
};

/** All variants side by side for visual comparison */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">
        <Trash2 size={14} /> Delete
      </Button>
      <Button variant="success">
        <Check size={14} /> Confirm
      </Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

/** All sizes side by side */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Plus size={18} />
      </Button>
    </div>
  ),
};
