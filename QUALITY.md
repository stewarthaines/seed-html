# Quality Standards & Validation

This document defines the quality standards, validation requirements, and coding practices for the editme-svelte project. All contributors and AI coding agents must follow these standards.

## 🚨 Zero-Tolerance Quality Policy

### TypeScript Compliance

**MANDATORY**: The codebase maintains **ZERO TypeScript errors** at all times. Any commit introducing TypeScript errors will be rejected.

- TypeScript validation is **REQUIRED BEFORE ALL COMMITS**
- Never defer or ignore TypeScript errors
- Fix type errors immediately when they occur
- Use proper typing instead of `any` or type assertions

### Quality Gates

All code changes must pass these validation steps before commit:

1. ✅ **TypeScript Validation**: `npm run check` (zero errors)
2. ✅ **ESLint Compliance**: `npm run lint` (< 500 problems, zero critical errors)
3. ✅ **Unit Tests**: `npm test` (all tests passing)
4. ✅ **Build Verification**: `npm run build` (successful build)

### Combined Quality Check

**Recommended workflow**:

```bash
npm run check && npm run lint && npm run format && npm test
```

## Validation Commands

### Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Required Quality Commands

- `npm run check` - **REQUIRED** TypeScript validation (must pass)
- `npm run lint` - **REQUIRED** ESLint check (zero warnings, zero errors)
- `npm run format` - **REQUIRED** Prettier code formatting for consistency
- `npm test` - **REQUIRED** Run unit tests (must pass)

### Testing Commands

- `npm test` - Run unit tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:stories` - Run Storybook tests with Vitest
- `npm run screenshots` - Capture component screenshots

### Storybook Commands

- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build Storybook for production

## AI Coding Agent Requirements

### Mandatory Behavior

- **Quality First**: Always prioritize TypeScript compliance and test validity
- **Error Resolution**: Fix type errors immediately, never defer or ignore
- **Validation Workflow**: Run quality checks frequently during development
- **Zero TypeScript Errors**: The user expects zero TypeScript errors in the codebase at all times

### Forbidden Actions

**Never Complete Tasks With**:

- Outstanding TypeScript errors
- Critical ESLint errors (undefined variables, syntax errors)
- Failing tests due to type issues
- Missing imports or class instantiation
- Commented-out critical code (especially test setup)

### Required Workflow

1. Run `npm run check` after any code modification
2. Resolve ALL TypeScript errors before considering any task complete
3. Ensure ESLint compliance (< 500 problems, zero critical errors)
4. Verify all tests pass
5. Confirm successful build

## Code Quality Standards

### TypeScript Standards

- Use strict TypeScript configuration
- Prefer explicit types over inference where clarity is improved
- Use proper error handling with typed exceptions
- Follow existing type patterns in the codebase

### ESLint Configuration

- See [LINTING.md](./LINTING.md) for detailed ESLint configuration
- Environment-specific rules for browser APIs
- VSCode integration and common issue resolution
- Acceptable lint thresholds and resolution patterns

### Testing Standards

- See [TESTING.md](./TESTING.md) for comprehensive testing strategy
- Test-driven development based on API specifications
- Unit tests for business logic, Storybook tests for browser APIs
- Mock external dependencies only, not internal logic

### Import Standards

- Use absolute paths (`$lib/`) even though some existing code doesn't

## Build Configuration Standards

### Svelte 5 Compatibility

- **Treeshaking**: Do NOT enable aggressive Rollup treeshaking options (`moduleSideEffects: false`, `propertyReadSideEffects: false`, `unknownGlobalSideEffects: false`)
- Svelte 5's reactivity system requires runtime side effects for signal registration and context initialization
- Aggressive treeshaking removes these dependencies, causing runtime errors like `"can't access property 'r1', t.l is null"`
- Use Vite's default treeshaking instead, which is tuned for Svelte compatibility

### Browser Support

- Modern browsers only (recent Safari, Chromium, Firefox, Edge)
- Supports both web server and file:// scheme URLs
- No external library dependencies in core app
- All static resources inlined by Vite build system

## Development Integration

### With Feature Development

- Quality validation is integrated into the 5-step feature development process
- API documentation must be created before implementation
- Unit tests must be written based on API specifications
- Implementation must pass all quality gates

### With Storybook

- Storybook serves as live documentation and manual testing interface
- Stories demonstrate features and integration patterns
- Visual verification and browser API testing
- Follow patterns in [STORYBOOK.md](./STORYBOOK.md)

### With Documentation

- API documentation standards defined in [DEVELOPMENT.md](./DEVELOPMENT.md)
- Component development guidelines integrated with quality requirements
- Documentation must be updated when quality standards change

## Enforcement

### Automated Checks

- TypeScript compiler integration
- ESLint pre-commit hooks (if configured)
- Continuous integration validation
- Build system enforcement

### Manual Review

- Code review checklist includes quality validation
- Pull request requirements include passing all quality gates
- No merge without successful quality validation

This document serves as the single source of truth for all quality requirements in the editme-svelte project. All other documentation should reference this document rather than duplicating these requirements.
