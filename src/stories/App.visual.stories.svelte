<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { userEvent, within } from 'storybook/test';
  import App from '../App.svelte';
  import { createVisualMockWorkspaceManager, VISUAL_SCENARIOS } from './utils/visual-mock-data';

  const { Story } = defineMeta({
    title: 'Application/App (Visual)',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Visual demonstration of the EDITME EPUB editor with pre-loaded sample data. These stories focus on showcasing UI states and design without functional backend operations.',
        },
      },
    },
    tags: ['autodocs'],
  });
</script>

<Story
  name="With Sample Content"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Application with sample book content loaded, showing spine items, metadata, and full workspace structure.',
      },
    },
  }}
/>

<Story
  name="Empty Project"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('empty'),
    initialWorkspaceId: 'empty-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story: 'Empty workspace showing the initial state when starting a new EPUB project.',
      },
    },
  }}
/>

<Story
  name="Large Book"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('largeBook'),
    initialWorkspaceId: 'large-book',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Workspace with a large book containing many chapters, demonstrating UI with substantial content.',
      },
    },
  }}
/>

<Story
  name="Section Navigation Demo"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Interactive tour through all sidebar sections to showcase the complete application workflow.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for app to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Navigate through sections
    const sections = [
      { name: 'Metadata', title: 'Metadata' },
      { name: 'Manifest', title: 'Manifest' },
      { name: 'Navigation', title: 'Navigation' },
      { name: 'Settings', title: 'Settings' },
      { name: 'Workspace', title: 'Workspace' },
    ];

    for (const section of sections) {
      try {
        const button = canvas.getByTitle(section.title);
        await userEvent.click(button);
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.log(`Could not find button for ${section.name}:`, error);
      }
    }
  }}
/>

<Story
  name="Sidebar Collapsed"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story: 'Application view with sidebar collapsed to maximize content editing space.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const toggleButton = canvas.getByLabelText('Toggle sidebar');
      await userEvent.click(toggleButton);
    } catch (error) {
      console.log('Could not find sidebar toggle:', error);
    }
  }}
/>

<Story
  name="Mobile/Tablet View"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    viewport: {
      name: 'tablet',
    },
    docs: {
      description: {
        story:
          'Application layout optimized for tablet viewing, showing responsive design adaptation.',
      },
    },
  }}
/>

<Story
  name="Spine Item Selection"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Demonstrates spine item selection workflow, showing how content selection works in the editor.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Find and click a spine item (should automatically navigate to spine view)
      const spineItems = canvas.getAllByRole('button');
      const chapterButton = spineItems.find(
        btn => btn.textContent?.includes('chapter-001') || btn.textContent?.includes('Chapter 1')
      );

      if (chapterButton) {
        console.log('Found chapter button:', chapterButton.textContent);
        await userEvent.click(chapterButton);
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Spine item clicked, should navigate to spine view');
      } else {
        console.log(
          'No chapter button found in:',
          spineItems.map(btn => btn.textContent)
        );
      }
    } catch (error) {
      console.log('Could not demonstrate spine selection:', error);
    }
  }}
/>

<Story
  name="Firefox Debug Test"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Debug story for testing Firefox-specific issues with spine item selection. Check browser console for detailed logging.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Enhanced logging for Firefox debugging
    console.log('=== FIREFOX DEBUG TEST START ===');
    console.log('Browser:', navigator.userAgent);
    console.log('Canvas element:', canvasElement);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // List all buttons for debugging
      const allButtons = canvas.getAllByRole('button');
      console.log(
        'All buttons found:',
        allButtons.map(btn => ({
          text: btn.textContent,
          title: btn.title,
          id: btn.id,
          classes: btn.className,
        }))
      );

      // Find spine item button
      const chapterButton = allButtons.find(btn => btn.textContent?.includes('chapter-001'));

      if (chapterButton) {
        console.log('Target chapter button:', {
          text: chapterButton.textContent,
          element: chapterButton,
        });

        // Test manual click first
        console.log('Attempting manual click...');
        chapterButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Then test userEvent click
        console.log('Attempting userEvent click...');
        await userEvent.click(chapterButton);
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('Clicks completed - check if spine view appeared');
      } else {
        console.error('No chapter button found!');
      }
    } catch (error) {
      console.error('Firefox debug test error:', error);
    }

    console.log('=== FIREFOX DEBUG TEST END ===');
  }}
/>

<Story
  name="Navigation Spine Selection Clear Test"
  args={{
    workspaceManager: createVisualMockWorkspaceManager('withContent'),
    initialWorkspaceId: 'demo-workspace',
  }}
  parameters={{
    docs: {
      description: {
        story:
          'Tests that spine item selection is cleared when navigating to other sidebar sections.',
      },
    },
  }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    console.log('=== NAVIGATION CLEAR TEST START ===');

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Step 1: Select a spine item (should navigate to spine view)
      console.log('Step 1: Selecting spine item...');
      const spineItems = canvas.getAllByRole('button');
      const chapterButton = spineItems.find(btn => btn.textContent?.includes('chapter-001'));

      if (chapterButton) {
        await userEvent.click(chapterButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Spine item selected and spine view should be active');

        // Step 2: Navigate to another section (should clear spine selection)
        console.log('Step 2: Navigating to Workspace section...');
        const workspaceButton = canvas.getByTitle('Workspace');
        await userEvent.click(workspaceButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Should have cleared spine selection and navigated to workspace');

        // Step 3: Navigate to Navigation section (the one that was problematic)
        console.log('Step 3: Navigating to Navigation section...');
        const navigationButton = canvas.getByTitle('Navigation');
        await userEvent.click(navigationButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Should remain cleared in navigation view');

        // Step 4: Navigate to Metadata section
        console.log('Step 4: Navigating to Metadata section...');
        const metadataButton = canvas.getByTitle('Metadata');
        await userEvent.click(metadataButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Should remain cleared in metadata view');
      } else {
        console.error('No spine item found for testing');
      }
    } catch (error) {
      console.error('Navigation clear test error:', error);
    }

    console.log('=== NAVIGATION CLEAR TEST END ===');
  }}
/>
