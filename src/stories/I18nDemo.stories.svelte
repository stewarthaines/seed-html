<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { userEvent, within } from 'storybook/test';
  import App from '../App.svelte';

  const { Story } = defineMeta({
    title: 'Features/Internationalization (i18n)',
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
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for i18n system to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Demonstrate navigation in current locale
    try {
      // Click through different sections to show localized content
      const metadataButton = canvas.getByTitle(/Metadata/);
      await userEvent.click(metadataButton);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const manifestButton = canvas.getByTitle(/Manifest/);
      await userEvent.click(manifestButton);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const workspaceButton = canvas.getByTitle(/Workspace/);
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
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for RTL layout to apply
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Demonstrate RTL-specific interactions
    try {
      // Toggle sidebar to show RTL positioning
      const toggleButton = canvas.getByLabelText(/Toggle sidebar/);
      await userEvent.click(toggleButton);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Expand again to show RTL sidebar behavior
      await userEvent.click(toggleButton);
      await new Promise(resolve => setTimeout(resolve, 500));
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
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for translations to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Tour through the interface to show translated content
    const sections = ['Metadata', 'Manifest', 'Navigation', 'Spine Items', 'Settings'];
    
    for (let i = 0; i < sections.length; i++) {
      try {
        const buttons = canvas.getAllByRole('button');
        const sectionButton = buttons.find(btn => 
          btn.getAttribute('title')?.includes(sections[i]) ||
          btn.textContent?.includes(sections[i])
        );
        
        if (sectionButton) {
          await userEvent.click(sectionButton);
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      } catch (error) {
        console.log(`Section ${sections[i]} navigation adapted for current locale`);
      }
    }
    
    // Return to workspace
    try {
      const workspaceButton = canvas.getByTitle(/Workspace/);
      await userEvent.click(workspaceButton);
    } catch (error) {
      console.log('Returning to workspace');
    }
  }}
/>