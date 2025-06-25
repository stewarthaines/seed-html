<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { userEvent, within } from 'storybook/test';
  import ThemeToggle from '../lib/ThemeToggle.svelte';

  const { Story } = defineMeta({
    title: 'UI/Theme System',
    component: ThemeToggle,
    parameters: {
      layout: 'padded',
      docs: {
        description: {
          component:
            'Theme system for EDITME EPUB editor providing light/dark mode toggle with system preference detection and localStorage persistence.',
        },
      },
    },
    tags: ['autodocs'],
    argTypes: {
      size: {
        control: { type: 'select' },
        options: ['small', 'medium', 'large'],
        description: 'Size variant of the toggle button',
      },
      showLabel: {
        control: { type: 'boolean' },
        description: 'Whether to show text label next to icon',
      },
    },
  });
</script>

<Story
  name="Theme Toggle - Default"
  args={{
    size: 'medium',
    showLabel: true,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Default theme toggle button showing current theme state with icon and label. Click to toggle between light and dark themes.',
      },
    },
  }}
/>

<Story
  name="Theme Toggle - Size Variants"
  parameters={{
    docs: {
      description: {
        story:
          'Theme toggle button in different sizes: small, medium, and large. Each maintains proper proportions and accessibility.',
      },
    },
  }}
>
  <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
      <ThemeToggle size="small" />
      <small>Small</small>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
      <ThemeToggle size="medium" />
      <small>Medium</small>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
      <ThemeToggle size="large" />
      <small>Large</small>
    </div>
  </div>
</Story>

<Story
  name="Theme Toggle - Icon Only"
  args={{
    size: 'medium',
    showLabel: false,
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Theme toggle button without text label, showing only the icon. Ideal for toolbars and compact interfaces.',
      },
    },
  }}
/>

<Story
  name="Design Token Showcase"
  parameters={{
    docs: {
      description: {
        story:
          'Comprehensive showcase of design tokens in both light and dark themes. Demonstrates colors, typography, spacing, and elevation tokens.',
      },
    },
  }}
>
  <div style="padding: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h2>Design Token Showcase</h2>
      <ThemeToggle />
    </div>
    
    <!-- Color Tokens -->
    <section style="margin-bottom: 3rem;">
      <h3 style="margin-bottom: 1rem;">Color Tokens</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div style="background-color: var(--color-bg-primary); border: 1px solid var(--color-border-default); padding: 1rem; border-radius: 8px;">
          <div style="font-weight: 600;">Primary Background</div>
          <div style="font-size: 0.875rem; color: var(--color-text-secondary);">var(--color-bg-primary)</div>
        </div>
        <div style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-default); padding: 1rem; border-radius: 8px;">
          <div style="font-weight: 600;">Secondary Background</div>
          <div style="font-size: 0.875rem; color: var(--color-text-secondary);">var(--color-bg-secondary)</div>
        </div>
        <div style="background-color: var(--color-accent); color: white; padding: 1rem; border-radius: 8px;">
          <div style="font-weight: 600;">Accent Color</div>
          <div style="font-size: 0.875rem; opacity: 0.9;">var(--color-accent)</div>
        </div>
      </div>
    </section>

    <!-- Typography Tokens -->
    <section style="margin-bottom: 3rem;">
      <h3 style="margin-bottom: 1rem;">Typography Tokens</h3>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="font-size: var(--text-xs);">Extra Small Text (var(--text-xs))</div>
        <div style="font-size: var(--text-sm);">Small Text (var(--text-sm))</div>
        <div style="font-size: var(--text-base);">Base Text (var(--text-base))</div>
        <div style="font-size: var(--text-lg);">Large Text (var(--text-lg))</div>
        <div style="font-size: var(--text-xl);">Extra Large Text (var(--text-xl))</div>
        <div style="font-size: var(--text-2xl);">2X Large Text (var(--text-2xl))</div>
      </div>
    </section>

    <!-- Spacing Tokens -->
    <section style="margin-bottom: 3rem;">
      <h3 style="margin-bottom: 1rem;">Spacing Tokens</h3>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: var(--space-1); height: 20px; background-color: var(--color-accent);"></div>
          <span>var(--space-1)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: var(--space-2); height: 20px; background-color: var(--color-accent);"></div>
          <span>var(--space-2)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: var(--space-4); height: 20px; background-color: var(--color-accent);"></div>
          <span>var(--space-4)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: var(--space-8); height: 20px; background-color: var(--color-accent);"></div>
          <span>var(--space-8)</span>
        </div>
      </div>
    </section>

    <!-- Shadow Tokens -->
    <section>
      <h3 style="margin-bottom: 1rem;">Elevation Tokens</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
        <div style="padding: 1rem; background-color: var(--color-bg-primary); box-shadow: var(--shadow-sm); border-radius: 8px;">
          <div style="font-weight: 600;">Small Shadow</div>
          <div style="font-size: 0.875rem; color: var(--color-text-secondary);">var(--shadow-sm)</div>
        </div>
        <div style="padding: 1rem; background-color: var(--color-bg-primary); box-shadow: var(--shadow-md); border-radius: 8px;">
          <div style="font-weight: 600;">Medium Shadow</div>
          <div style="font-size: 0.875rem; color: var(--color-text-secondary);">var(--shadow-md)</div>
        </div>
        <div style="padding: 1rem; background-color: var(--color-bg-primary); box-shadow: var(--shadow-lg); border-radius: 8px;">
          <div style="font-weight: 600;">Large Shadow</div>
          <div style="font-size: 0.875rem; color: var(--color-text-secondary);">var(--shadow-lg)</div>
        </div>
      </div>
    </section>
  </div>
</Story>

<Story
  name="Theme System Integration"
  parameters={{
    docs: {
      description: {
        story:
          'Demonstration of theme system integration with various UI components. Shows how design tokens adapt across light and dark themes.',
      },
    },
  }}
>
  <div style="padding: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h2>Theme System Integration</h2>
      <ThemeToggle />
    </div>

    <!-- Card Components -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
      <div style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-default); padding: 1.5rem; border-radius: 8px;">
        <h4 style="margin: 0 0 0.5rem 0; color: var(--color-text-primary);">Card Title</h4>
        <p style="margin: 0; color: var(--color-text-secondary); font-size: var(--text-sm);">
          This is a sample card component using design tokens that automatically adapt to the current theme.
        </p>
      </div>
      <div style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-default); padding: 1.5rem; border-radius: 8px;">
        <h4 style="margin: 0 0 0.5rem 0; color: var(--color-text-primary);">Another Card</h4>
        <p style="margin: 0; color: var(--color-text-secondary); font-size: var(--text-sm);">
          Notice how all colors, borders, and backgrounds change seamlessly when switching themes.
        </p>
      </div>
    </div>

    <!-- Button Examples -->
    <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;">
      <button style="background-color: var(--color-accent); color: white; border: none; padding: var(--space-2) var(--space-4); border-radius: 6px; font-size: var(--text-sm); cursor: pointer;">
        Primary Button
      </button>
      <button style="background-color: var(--color-bg-secondary); color: var(--color-text-primary); border: 1px solid var(--color-border-default); padding: var(--space-2) var(--space-4); border-radius: 6px; font-size: var(--text-sm); cursor: pointer;">
        Secondary Button
      </button>
      <button style="background-color: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border-default); padding: var(--space-2) var(--space-4); border-radius: 6px; font-size: var(--text-sm); cursor: pointer;">
        Outline Button
      </button>
    </div>

    <!-- Form Elements -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div>
        <label style="display: block; margin-bottom: 0.5rem; font-size: var(--text-sm); color: var(--color-text-primary);">
          Text Input
        </label>
        <input 
          type="text" 
          placeholder="Enter text..."
          style="width: 100%; padding: var(--space-2); border: 1px solid var(--color-border-default); border-radius: 4px; background-color: var(--color-bg-primary); color: var(--color-text-primary); font-size: var(--text-sm);"
        />
      </div>
      <div>
        <label style="display: block; margin-bottom: 0.5rem; font-size: var(--text-sm); color: var(--color-text-primary);">
          Select Dropdown
        </label>
        <select style="width: 100%; padding: var(--space-2); border: 1px solid var(--color-border-default); border-radius: 4px; background-color: var(--color-bg-primary); color: var(--color-text-primary); font-size: var(--text-sm);">
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
      </div>
    </div>

    <div style="margin-top: 2rem; padding: 1rem; background-color: var(--color-bg-secondary); border-left: 4px solid var(--color-accent); border-radius: 4px;">
      <p style="margin: 0; color: var(--color-text-primary); font-size: var(--text-sm);">
        <strong>Theme Integration:</strong> All components automatically adapt their colors, borders, and styling based on the current theme using CSS custom properties.
      </p>
    </div>
  </div>
</Story>

<Story
  name="Interactive Theme Demo"
  parameters={{
    docs: {
      description: {
        story:
          'Interactive demonstration showing theme persistence and system preference detection. Toggle themes and see how the change persists across browser sessions.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Toggle theme a few times to demonstrate functionality
    const toggleButton = canvas.getByLabelText('Toggle theme');
    
    await userEvent.click(toggleButton);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await userEvent.click(toggleButton);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Final toggle to dark for demonstration
    await userEvent.click(toggleButton);
  }}
>
  <div style="padding: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h2>Interactive Theme Demo</h2>
      <ThemeToggle />
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <h3>Theme Features</h3>
        <ul style="color: var(--color-text-secondary);">
          <li>Light/Dark mode toggle</li>
          <li>System preference detection</li>
          <li>localStorage persistence</li>
          <li>Automatic CSS custom property updates</li>
          <li>Seamless theme switching</li>
        </ul>
      </div>
      
      <div style="background-color: var(--color-bg-secondary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--color-border-default);">
        <h4 style="margin-top: 0; color: var(--color-text-primary);">Current Theme Info</h4>
        <div style="font-size: var(--text-sm); color: var(--color-text-secondary);">
          <p>The theme toggle button shows the opposite theme icon - clicking the sun icon switches to light mode, clicking the moon icon switches to dark mode.</p>
          <p>Theme preferences are automatically saved to localStorage and restored on next visit.</p>
        </div>
      </div>
    </div>
  </div>
</Story>