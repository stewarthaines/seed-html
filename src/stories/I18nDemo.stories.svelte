<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import App from '../App.svelte';

  const { Story } = defineMeta({
    title: 'Application/Internationalization (i18n)',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Complete internationalization system supporting 7 languages with automatic RTL layout, browser locale detection, and real-time language switching. Use the locale switcher in the Storybook toolbar (🌍 icon) to test different languages.',
        },
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="Language Switching Demo"
  parameters={{
    docs: {
      description: {
        story:
          '🌍 **Interactive Language Demo**: Switch between languages using the locale selector in the Storybook toolbar. Supported languages include English 🇺🇸, German 🇩🇪, Arabic 🇸🇦 (RTL), Hebrew 🇮🇱 (RTL), Japanese 🇯🇵, Georgian 🇬🇪, and Traditional Chinese 🇹🇼. Notice how the interface automatically adjusts for right-to-left languages.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // Wait for i18n system to initialize by looking for specific elements
    await canvas.findByRole('main', {}, { timeout: 5000 });

    // Demonstrate navigation in current locale
    try {
      // Click through different sections to show localized content
      const metadataButton = await canvas.findByTitle(/Metadata/, {}, { timeout: 3000 });
      await userEvent.click(metadataButton);
      
      // Wait for metadata view to load
      await canvas.findByRole('tabpanel', {}, { timeout: 3000 });

      const manifestButton = await canvas.findByTitle(/Manifest/, {}, { timeout: 3000 });
      await userEvent.click(manifestButton);
      
      // Wait for manifest view to load
      await canvas.findByRole('table', {}, { timeout: 3000 });

      const workspaceButton = await canvas.findByTitle(/Workspace/, {}, { timeout: 3000 });
      await userEvent.click(workspaceButton);
    } catch (error) {
      // Fallback for languages where title attributes might be different
      console.log('Navigation demo adapted for current locale');
    }
  }}
/>

<Story
  name="RTL Layout Demo"
  parameters={{
    docs: {
      description: {
        story:
          '📱 **Right-to-Left Layout**: This story demonstrates RTL (right-to-left) layout support. Switch to Arabic (العربية) or Hebrew (עברית) in the locale switcher to see the interface automatically flip to RTL layout. The sidebar moves to the right, text alignment changes, and all layout elements respect the RTL direction.',
      },
    },
    globals: {
      locale: 'ar', // Default to Arabic to show RTL
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // Wait for RTL layout to apply by checking for RTL-specific elements
    await canvas.findByRole('main', {}, { timeout: 5000 });

    // Demonstrate RTL-specific interactions
    try {
      // Toggle sidebar to show RTL positioning
      const toggleButton = await canvas.findByLabelText(/Toggle sidebar/i, {}, { timeout: 3000 });
      await userEvent.click(toggleButton);
      
      // Wait for sidebar animation/transition to complete
      await canvas.findByRole('complementary', { hidden: true }, { timeout: 2000 });

      // Expand again to show RTL sidebar behavior
      await userEvent.click(toggleButton);
      
      // Wait for sidebar to expand again
      await canvas.findByRole('complementary', {}, { timeout: 2000 });
    } catch (error) {
      console.log('RTL demo completed');
    }
  }}
/>

<Story
  name="Translation Coverage"
  parameters={{
    docs: {
      description: {
        story:
          '📝 **Translation System**: This story shows the comprehensive translation coverage across the application. All user-facing text is translatable, including navigation labels, form elements, placeholder text, and interactive elements. The system includes fallback mechanisms and parameter interpolation for dynamic content.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    // Wait for translations to load by checking for main interface
    await canvas.findByRole('main', {}, { timeout: 5000 });

    // Tour through the interface to show translated content
    const sections = ['Metadata', 'Manifest', 'Navigation', 'Spine Items', 'Settings'];

    for (let i = 0; i < sections.length; i++) {
      try {
        const buttons = await canvas.findAllByRole('button', {}, { timeout: 2000 });
        const sectionButton = buttons.find(
          btn =>
            btn.getAttribute('title')?.includes(sections[i]) ||
            btn.textContent?.includes(sections[i])
        );

        if (sectionButton) {
          await userEvent.click(sectionButton);
          // Wait for section to load by looking for main content
          await canvas.findByRole('main', {}, { timeout: 3000 });
        }
      } catch (error) {
        console.log(`Section ${sections[i]} navigation adapted for current locale`);
      }
    }

    // Return to workspace
    try {
      const workspaceButton = await canvas.findByTitle(/Workspace/, {}, { timeout: 3000 });
      await userEvent.click(workspaceButton);
    } catch (error) {
      console.log('Returning to workspace');
    }
  }}
/>
