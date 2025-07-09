# Development Guide

## Overview

This document provides comprehensive guidance for feature development, API documentation standards, component development, and quality assurance workflows in the editme-svelte project.

## Feature Development Process

The project follows a structured development process to ensure high-quality, well-documented features:

### 1. Feature Planning & Specification

- Start with detailed feature plan in `plans/features/{number}_{name}.md`
- Collaborate on requirements, technical approach, and integration points
- Define API interfaces, error handling, and performance considerations
- Clarify implementation details through iterative discussion

### 2. API Documentation

- Create comprehensive `src/lib/{feature}/API.md` **before implementation**
- Document all public methods with Input/Output/Side Effects/Usage examples
- Include error scenarios, edge cases, and integration patterns
- Add testing considerations and internal API details for unit test development

### 3. Unit Test Development

- Write comprehensive unit tests based on the API documentation **before implementation**
- Cover all methods, error scenarios, edge cases, and integration points
- Test internal behavior, caching, error handling, and state management
- Ensure tests validate the API contract defined in documentation
- Use existing shared mocks where available in src/lib/test/mocks/

### 4. Implementation

- Implement the feature following the API specification exactly
- Code should pass all unit tests without requiring test modifications
- Focus on meeting the documented API contract and behavior
- Implementation validates that the API design is practical and complete

### 5. Storybook Story Creation

- Create interactive Storybook stories demonstrating the feature
- Show integration patterns, error scenarios, and real-world usage
- Follow patterns in `STORYBOOK.md` for backend feature demonstrations
- Stories serve as live documentation and manual testing interface

This process ensures features are well-designed, thoroughly tested, and properly documented before implementation begins. The API documentation serves as a contract that guides both test development and implementation.

## API Documentation Standards

### Writing API Documentation

When implementing new features, create comprehensive API documentation in `src/lib/{feature}/API.md` following these standards:

#### Required Sections:

1. **Overview** - Brief description of main classes and purpose
2. **Class Documentation** - Each public class with constructor and methods
3. **Method Documentation** - Input/Output/Side Effects/Usage examples for each method
4. **Type Definitions** - All publicly useful interfaces and types
5. **Common Integration Patterns** - Real-world usage examples
6. **Error Handling** - Exception types and error handling patterns

#### Documentation Style:

````typescript
#### methodName()

```typescript
methodName(param: Type): Promise<ReturnType>
```

**Input:**
- `param: Type` - Description of parameter

**Output:** `Promise<ReturnType>` - Description of return value

**Side Effects:** List any side effects (file creation, state changes, etc.)

**Usage:**

```typescript
const example = new ClassName();
const result = await example.methodName(value);
console.log('Result:', result);
```
````

#### Key Guidelines:

- **Focus on Integration**: Show how the API integrates with other features
- **Practical Examples**: Include real-world usage patterns, not toy examples
- **Error Scenarios**: Document common error cases and handling
- **Browser Compatibility**: Note any browser-specific behavior or limitations
- **Performance Notes**: Highlight performance characteristics and optimization tips

#### Examples to Follow:

- `src/lib/epub/API.md` - Comprehensive EPUB library documentation
- `src/lib/storage/API.md` - File Storage API with backend detection details

#### When to Create API Docs:

- **New feature implementation** - Always create API.md for new `src/lib/{feature}/` modules
- **Public API changes** - Update existing API.md when interfaces change
- **Integration points** - Document any APIs that other features will consume
- **Complex workflows** - Show end-to-end integration patterns

## Component Development Guidelines

When creating new components, follow these accessibility and development standards:

### Accessibility Checklist

Before considering a component complete:

- ✅ **Use Semantic HTML**: Use proper elements (`<button>`, `<nav>`, `<input>`) instead of `<div>` with event handlers
- ✅ **Add ARIA Labels**: Include `aria-label` for icon-only buttons and controls
- ✅ **Include Focus Styles**: Apply `:focus-visible` styles using design system tokens
- ✅ **Ensure Touch Targets**: Interactive elements must be at least 44x44 pixels
- ✅ **Let Svelte Help**: Trust Svelte's compiler to catch accessibility issues

### Development Patterns

**Reference Components**: Learn from existing accessible patterns in:

- `ThemeToggle.svelte` - Icon button with proper ARIA
- `Sidebar.svelte` - Navigation with semantic markup

**Documentation**: See comprehensive guides at:

- `src/lib/components/ACCESSIBILITY.md` - Component patterns and examples
- `src/styles/ACCESSIBILITY.md` - CSS tokens and styling guidelines

### Testing Requirements

- **Keyboard Navigation**: Tab through your interface - can you see focus clearly?
- **Svelte Warnings**: Component must compile without accessibility warnings
- **Touch Targets**: Test on mobile - are interactive elements easy to tap?

## Development Workflow Quality Standards

### Feature Development:

- Write TypeScript-compliant code from the start
- Run `npm run check` frequently during development
- Address TypeScript errors immediately, never defer

### Test Development:

- All new tests must be TypeScript compliant
- Use proper type assertions (`as any`) only when necessary for mocks
- Ensure test files import and instantiate classes correctly

### Error Resolution:

- Fix TypeScript errors before implementing new features
- Never commit partial fixes that leave errors unresolved
- Use proper type definitions instead of suppressing errors

### Quality Enforcement for AI Coding Agents

**Mandatory Validation**: All coding agents (Claude, GitHub Copilot, etc.) must:

1. Run `npm run check` after any code modification
2. Resolve ALL TypeScript errors before considering a task complete
3. Verify that tests pass and are TypeScript compliant
4. Never use `@ts-ignore` or `any` types unless absolutely necessary

**Error Prevention**: Coding agents should:

- Validate imports and class instantiation
- Use proper mock types for testing
- Ensure interface compliance in all implementations
- Test both positive and negative cases for type safety

## Step-by-Step Quality Assurance Process

Follow this workflow for ALL development work to prevent TypeScript errors from entering the codebase:

### 1. 🏗️ Development Phase

```bash
# Start development with clean state
npm run check  # Verify current state is clean

# During active development (run frequently):
npm run check  # Check types after significant changes
npm run test:watch  # Run tests continuously
```

### 2. ✅ Pre-Commit Validation Phase

**MANDATORY** before any commit:

```bash
# Full quality validation (all must pass):
npm run check     # TypeScript validation (zero errors)
npm run lint      # ESLint compliance (< 500 problems, zero critical errors)
npm test          # Unit test execution (all tests passing)
npm run build     # Production build verification

# Alternative: Combined command
npm run check && npm run lint && npm test && npm run build
```

### 3. 🚨 Error Resolution Protocol

If any validation fails:

1. **TypeScript Errors**:
   - Fix immediately, never defer
   - Use proper types, avoid `any` unless necessary
   - Ensure imports and class instantiation are correct

2. **ESLint Errors**:
   - Address code style and potential bugs
   - Use `npm run lint -- --fix` for auto-fixable issues
   - Focus on errors in main source code, warnings in demo/story files are acceptable

3. **Test Failures**:
   - Fix broken functionality
   - Update tests if API contracts changed
   - Ensure new tests are TypeScript compliant

4. **Build Failures**:
   - Resolve any remaining compilation issues
   - Check for missing dependencies or configuration errors

### 4. 📋 Code Review Checklist

Before requesting code review:

- [ ] Zero TypeScript errors (`npm run check`)
- [ ] ESLint compliance (`npm run lint` - < 500 problems, zero critical errors)
- [ ] All tests passing (`npm test`)
- [ ] Production build successful (`npm run build`)
- [ ] No use of `@ts-ignore` without justification
- [ ] Proper type definitions for new interfaces
- [ ] Mock types compatible with real implementations

### 5. 🤖 AI Coding Agent Workflow

For AI assistants (Claude, GitHub Copilot, etc.):

**Required Actions:**

1. Run `npm run check` after EVERY code modification
2. Run `npm run lint` to verify ESLint compliance (< 500 problems, zero critical errors)
3. Fix ALL TypeScript errors before task completion
4. Verify tests pass and are TypeScript compliant
5. Document any intentional use of `any` types
6. Ensure proper import statements and class instantiation

**Never Complete a Task With:**

- Outstanding TypeScript errors
- Critical ESLint errors (undefined variables, syntax errors)
- Commented-out critical code (like test setup)
- Missing imports or incorrect class instantiation
- Failing tests due to type issues

**Acceptable in Final State:**

- ESLint warnings in demo/story files (< 500 total problems)
- Console statement warnings in main source code
- Style preference warnings (prefer-const, etc.)
