# Code Formatting Setup

This project uses **Prettier** and **ESLint** to enforce consistent code style across all developers and automated tools.

## ✅ **Configuration Summary**

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always
- **Trailing commas**: ES5 style (objects, arrays)
- **Line width**: 100 characters
- **End of line**: LF (Unix style)

## 🛠 **VS Code Setup**

### Required Extensions

- **Prettier - Code formatter** (`esbenp.prettier-vscode`)
- **Svelte for VS Code** (`svelte.svelte-vscode`)
- **ESLint** (`dbaeumer.vscode-eslint`)

### Auto-Setup

VS Code settings are already configured in `.vscode/settings.json`:

- Format on save enabled
- Prettier as default formatter
- ESLint auto-fix on save
- Consistent tab size (2 spaces)

## 📜 **npm Scripts**

```bash
# Check if code is properly formatted
npm run format:check

# Auto-format all files
npm run format

# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix
```

## 🚀 **For Developers**

### First Time Setup

1. Install recommended VS Code extensions (you'll get a prompt)
2. That's it! Formatting will happen automatically on save

### Manual Formatting

```bash
# Format all files
npm run format

# Format specific files
npx prettier --write src/components/MyComponent.svelte
```

## 🤖 **For Claude Code**

When Claude makes changes to the codebase, all code follows the same formatting rules automatically. The configuration ensures:

- All TypeScript/JavaScript uses 2-space indentation
- All Svelte files use consistent formatting
- Quotes, semicolons, and spacing are standardized
- Git diffs stay clean and focused on actual changes

## 📁 **Configuration Files**

- `.prettierrc` - Prettier formatting rules
- `.prettierignore` - Files to skip formatting
- `.vscode/settings.json` - VS Code editor settings
- `.vscode/extensions.json` - Recommended extensions
- `eslint.config.js` - ESLint rules (already configured)

## 🔧 **Troubleshooting**

If formatting isn't working:

1. **VS Code**: Install Prettier extension and reload window
2. **Command line**: Run `npm run format` manually
3. **Git hooks**: Consider adding a pre-commit hook that runs `npm run format:check`

The setup ensures all developers and automated tools (including Claude) produce consistently formatted code.
