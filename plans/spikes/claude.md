# Spike Development Instructions

## Spike Requirements

All spikes for the EDITME project must be **self-contained single HTML files** that can be opened directly in a browser.

### Key Requirements:

- **Single file**: All code, styles, and markup in one HTML file
- **No external dependencies**: No separate CSS, JS, or asset files
- **Inline everything**: All styles in `<style>` tags, all scripts in `<script>` tags
- **File:// compatible**: Must work when opened directly from filesystem
- **Self-documenting**: Include clear comments explaining the spike purpose

### Structure Template:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Spike Name - EDITME</title>
    <style>
      /* All CSS styles inline */
    </style>
  </head>
  <body>
    <!-- Simple UI for testing the spike concept -->

    <script>
      // All JavaScript inline
      // Include mock data as needed
      // Demonstrate the core concept being tested
    </script>

    <!-- Any additional inline scripts for special cases -->
  </body>
</html>
```

### Naming Convention:

- File name: `spike_{concept_name}.html`
- Location: `src/spikes/`
- Example: `spike_service_worker_preview.html`

### Purpose:

Spikes are for rapid prototyping and concept validation. They should:

- Test a specific technical approach
- Validate browser API compatibility
- Explore integration possibilities
- Demonstrate proof of concept
- Be disposable after learning is captured

### Testing:

- Must work in modern browsers (Chrome, Firefox, Safari, Edge)
- Test by double-clicking HTML file to open in browser
- Use browser developer tools to verify functionality
- Document findings in corresponding spike planning document
