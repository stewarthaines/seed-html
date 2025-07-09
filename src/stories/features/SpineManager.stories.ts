import type { Meta, StoryObj } from '@storybook/svelte';
import SpineManagerDemo from './SpineManagerDemo.svelte';

const meta = {
  title: 'Features/Spine Manager',
  component: SpineManagerDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Interactive demonstration of the Spine Item Manager UI for managing EPUB chapter ordering',
      },
    },
  },
} satisfies Meta<SpineManagerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic spine management interface showing:
 * - Spine item listing with chapter IDs
 * - Drag and drop reordering (when sidebar expanded)
 * - Move up/down buttons (on selected items)
 * - Validation indicators
 * - Append new chapter functionality
 */
export const Default: Story = {
  args: {},
};

/**
 * Spine manager with pre-populated chapters showing:
 * - Multiple chapters in order
 * - Some with validation errors (missing source files)
 * - Selection state
 * - Reordering capabilities
 */
export const WithChapters: Story = {
  args: {
    preloadChapters: true,
  },
};

/**
 * Collapsed sidebar view showing:
 * - Navigation only mode
 * - No drag handles
 * - Chapter selection still works
 * - Move buttons appear on selected items
 */
export const CollapsedSidebar: Story = {
  args: {
    preloadChapters: true,
    startCollapsed: true,
  },
};

/**
 * Error state demonstration showing:
 * - Failed to load spine items
 * - Retry functionality
 * - Error message display
 */
export const ErrorState: Story = {
  args: {
    simulateError: true,
  },
};
