/**
 * Demo content generators for Storybook stories
 *
 * Provides realistic, varied content for testing different scenarios
 */

import type { DemoChapter, DemoMetadata } from './workspace-story-utils';

// Content templates for generating varied chapters
const CHAPTER_TEMPLATES = {
  adventure: {
    title: 'The Great Adventure',
    content: `# {title}

## A Journey Begins

In this thrilling chapter, our heroes embark on a quest that will test their courage and determination. The path ahead is uncertain, but their resolve is unwavering.

### Key Moments

- The call to adventure arrives unexpectedly
- Companions gather for the perilous journey  
- Ancient maps reveal hidden dangers
- The first challenge appears on the horizon

> "Every journey of a thousand miles begins with a single step." - Ancient Proverb

The landscape stretches endlessly before them, filled with promise and peril in equal measure.`,
  },
  mystery: {
    title: 'The Enigma Unfolds',
    content: `# {title}

## Clues in the Shadows

Detective work requires patience, observation, and an eye for detail. In this chapter, seemingly unrelated events begin to form a pattern.

### Evidence Discovered

1. **The locked room mystery** - How did the perpetrator escape?
2. **Mysterious footprints** - Leading nowhere and everywhere
3. **The missing witness** - Who saw what really happened?
4. **Hidden messages** - Coded communications reveal deeper plots

The truth lies buried beneath layers of deception, waiting for the right mind to uncover it.

> "The game is afoot!" - Detective Literature

Each clue brings us closer to the stunning revelation that awaits.`,
  },
  science: {
    title: 'Scientific Discoveries',
    content: `# {title}

## Research and Innovation

Scientific progress depends on careful observation, rigorous experimentation, and peer review. This chapter explores breakthrough discoveries.

### Research Methodology

- **Hypothesis Formation**: Building testable predictions
- **Experimental Design**: Controls and variables
- **Data Collection**: Precise measurements and observations
- **Analysis**: Statistical significance and interpretation
- **Peer Review**: Validation by the scientific community

The implications of these findings extend far beyond the laboratory walls.

### Results and Discussion

The data reveals patterns previously unknown to science, opening new avenues for exploration and understanding.`,
  },
  historical: {
    title: 'Echoes of the Past',
    content: `# {title}

## Lessons from History

Understanding the past provides crucial context for present decisions. This chapter examines pivotal moments that shaped our world.

### Timeline of Events

**Early Period**: Foundations are laid for future developments

**Middle Period**: Critical turning points emerge  

**Modern Era**: Consequences of earlier decisions become clear

### Primary Sources

Historical documents, letters, and artifacts provide firsthand accounts of these momentous events.

> "Those who do not learn from history are doomed to repeat it." - Historical Wisdom

The connections between past and present become increasingly apparent as we examine the evidence.`,
  },
};

/**
 * Generate sample chapters with varied content types
 */
export function generateVariedChapters(count: number = 5): DemoChapter[] {
  const templates = Object.values(CHAPTER_TEMPLATES);
  const chapters: DemoChapter[] = [];

  // Always include a prologue
  chapters.push({
    id: 'prologue',
    title: 'Prologue',
    content: `# Prologue

## The Beginning of Everything

Every story has its origins, and this tale begins in an ordinary place with extraordinary potential. What follows will challenge everything we thought we knew.

The stage is set, the characters are ready, and the adventure is about to begin...`,
    linear: true,
  });

  // Generate varied chapters using different templates
  for (let i = 1; i <= count; i++) {
    const template = templates[(i - 1) % templates.length];
    const title = `Chapter ${i}: ${template.title}`;

    chapters.push({
      id: `chapter${i}`,
      title,
      content: template.content.replace('{title}', title),
      linear: true,
    });
  }

  // Add an epilogue (non-linear for validation testing)
  chapters.push({
    id: 'epilogue',
    title: 'Epilogue',
    content: `# Epilogue

## The Story Concludes

As our tale draws to a close, we reflect on the journey taken and the lessons learned. The characters have grown, challenges have been overcome, and new possibilities stretch ahead.

This epilogue is marked as non-linear to demonstrate validation warnings in the spine manager.

> "Every ending is a new beginning in disguise."

The story may be complete, but its impact will resonate far beyond these final words.`,
    linear: false,
  });

  return chapters;
}

/**
 * Generate minimal chapters for testing basic functionality
 */
export function generateMinimalChapters(): DemoChapter[] {
  return [
    {
      id: 'chapter1',
      title: 'Chapter 1',
      content: '# Chapter 1\n\nSimple chapter content for basic testing.',
      linear: true,
    },
    {
      id: 'chapter2',
      title: 'Chapter 2',
      content: '# Chapter 2\n\nAnother simple chapter.',
      linear: true,
    },
  ];
}

/**
 * Generate chapters with specific problems for error testing
 */
export function generateProblematicChapters(): DemoChapter[] {
  return [
    {
      id: 'working-chapter',
      title: 'Working Chapter',
      content: '# Working Chapter\n\nThis chapter works perfectly.',
      linear: true,
    },
    {
      id: 'missing-source',
      title: 'Missing Source Chapter',
      content: '# Missing Source\n\nThis chapter will be missing its source file.',
      linear: true,
    },
    {
      id: 'nonlinear-chapter',
      title: 'Non-Linear Chapter',
      content: '# Non-Linear Chapter\n\nThis chapter is marked as non-linear.',
      linear: false,
    },
    {
      id: 'special-chars',
      title: 'Chapter with Special Characters: éñ中文',
      content: `# Chapter with Special Characters

This chapter tests Unicode handling:
- Accented characters: café, naïve, résumé
- Non-Latin scripts: 中文, العربية, עברית
- Symbols: ©, ™, ®, €, ¥`,
      linear: true,
    },
  ];
}

/**
 * Generate metadata variations for different story types
 */
export function generateMetadataVariations(): Record<string, Partial<DemoMetadata>> {
  return {
    novel: {
      title: 'The Great Adventure Novel',
      creator: ['Adventure Author'],
      description: 'An epic tale of courage and discovery',
      subject: ['Fiction', 'Adventure', 'Coming of Age'],
      publisher: 'Demo Fiction Press',
    },
    technical: {
      title: 'Technical Documentation Guide',
      creator: ['Technical Writer', 'Subject Matter Expert'],
      description: 'Comprehensive guide to technical writing',
      subject: ['Technology', 'Documentation', 'Reference'],
      publisher: 'Technical Publications',
    },
    educational: {
      title: 'Interactive Learning Module',
      creator: ['Educational Designer'],
      description: 'Engaging educational content with interactive elements',
      subject: ['Education', 'Interactive', 'Learning'],
      publisher: 'Educational Resources Inc.',
    },
    multilingual: {
      title: 'Multilingual Content Sample',
      language: 'en',
      creator: ['International Author'],
      description: 'Sample content for testing internationalization',
      subject: ['Multilingual', 'Internationalization', 'Testing'],
      publisher: 'Global Publishing House',
    },
  };
}

/**
 * Generate sample CSS content variations
 */
export function generateCSSVariations(): Record<string, string> {
  return {
    minimal: `/* Minimal EPUB Styles */
body { font-family: serif; line-height: 1.4; }
h1 { font-size: 1.5em; margin: 1em 0; }
p { margin-bottom: 1em; }`,

    modern: `/* Modern EPUB Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 40em;
  margin: 0 auto;
  padding: 1em;
}

h1, h2, h3 {
  color: #2c3e50;
  margin-top: 2em;
  margin-bottom: 0.5em;
}

h1 { 
  font-size: 2.5em; 
  border-bottom: 3px solid #3498db;
  padding-bottom: 0.3em;
}

blockquote {
  border-left: 4px solid #3498db;
  margin: 1em 0;
  padding: 0.5em 1em;
  background: #f8f9fa;
  font-style: italic;
}`,

    classic: `/* Classic Book Styles */
body {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.5;
  text-align: justify;
  margin: 1in;
}

h1 {
  text-align: center;
  font-size: 18pt;
  margin: 2em 0 1em;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.drop-cap {
  float: left;
  font-size: 4em;
  line-height: 0.8;
  margin: 0.1em 0.1em 0 0;
}`,
  };
}

/**
 * Generate extension content for demo purposes
 */
export interface DemoExtension {
  id: string;
  name: string;
  description: string;
  content: string;
  type: 'transform' | 'ui' | 'utility';
}

export function generateSampleExtensions(): DemoExtension[] {
  return [
    {
      id: 'text-formatter',
      name: 'Text Formatter',
      description: 'Formats text with additional typography rules',
      type: 'transform',
      content: `// Text Formatting Extension
export function transformText(input) {
  // Add smart quotes
  let output = input.replace(/"/g, '"').replace(/"/g, '"');
  // Add em dashes
  output = output.replace(/--/g, '—');
  return output;
}`,
    },
    {
      id: 'word-count',
      name: 'Word Counter',
      description: 'Displays word count statistics',
      type: 'ui',
      content: `// Word Count Extension
export function createWordCountWidget(text) {
  const words = text.split(/\\s+/).filter(w => w.length > 0);
  return {
    wordCount: words.length,
    characterCount: text.length,
    readingTime: Math.ceil(words.length / 200) // ~200 WPM
  };
}`,
    },
    {
      id: 'table-generator',
      name: 'Table Generator',
      description: 'Converts simple syntax to HTML tables',
      type: 'transform',
      content: `// Table Generator Extension
export function processTableSyntax(input) {
  // Convert | syntax to HTML tables
  return input.replace(/\\|(.+)\\|/g, (match, content) => {
    const cells = content.split('|').map(cell => 
      '<td>' + cell.trim() + '</td>'
    ).join('');
    return '<tr>' + cells + '</tr>';
  });
}`,
    },
  ];
}

/**
 * Generate test scenarios for different story needs
 */
export interface TestScenario {
  name: string;
  description: string;
  metadata: Partial<DemoMetadata>;
  chapters: DemoChapter[];
  skipMissingChapters?: string[];
  includeCSS?: boolean;
  includeExtensions?: boolean;
}

export function generateTestScenarios(): Record<string, TestScenario> {
  return {
    basicNovel: {
      name: 'Basic Novel',
      description: 'Simple novel structure with working chapters',
      metadata: generateMetadataVariations().novel,
      chapters: generateVariedChapters(3),
      includeCSS: true,
    },

    withErrors: {
      name: 'With Validation Errors',
      description: 'Content with missing files and validation issues',
      metadata: generateMetadataVariations().technical,
      chapters: generateProblematicChapters(),
      skipMissingChapters: ['missing-source'],
      includeCSS: true,
    },

    minimal: {
      name: 'Minimal Content',
      description: 'Bare minimum content for basic functionality',
      metadata: { title: 'Minimal Demo' },
      chapters: generateMinimalChapters(),
      includeCSS: false,
    },

    comprehensive: {
      name: 'Comprehensive Demo',
      description: 'Full-featured demo with all elements',
      metadata: generateMetadataVariations().educational,
      chapters: generateVariedChapters(7),
      includeCSS: true,
      includeExtensions: true,
    },
  };
}
