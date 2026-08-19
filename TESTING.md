# Testing Guide

This document describes the testing setup and strategy for the OneView webapp.

## Test Framework

- **Test Runner**: [Vitest](https://vitest.dev/) v3.2.4
- **Component Testing**: [React Testing Library](https://testing-library.com/react) v16.2.0
- **API Mocking**: [MSW (Mock Service Worker)](https://mswjs.io/) v2.8.3
- **Coverage**: V8 provider

## Running Tests

```bash
# Run all tests (watch mode)
npm run test:watch

# Run tests once
npm run test

# Run tests with coverage report
npm run test:ci

# Run tests with UI
npm run test:ui
```

## Test Structure

Tests are colocated with source code in `__tests__` directories:

```
app/
├── lib/
│   ├── session.ts
│   └── __tests__/
│       └── session.test.ts
├── store/
│   ├── api.ts
│   └── __tests__/
│       └── api.test.ts
└── components/
    ├── Header.tsx
    └── __tests__/
        └── Header.test.ts
```

## Test Coverage

Current test coverage focuses on critical authentication and session management features:

- ✅ **Session Management** (`app/lib/session.ts`) - 72.72% coverage
  - Auth token storage/retrieval
  - Advisor profile storage/retrieval
  - Integrated logout flow

- ✅ **CRM API Endpoints** (`app/store/api.ts`) - 70.72% coverage
  - CRM login endpoint
  - CRM logout endpoint
  - Error handling
  - API response validation

## Writing Tests

### Unit Tests

```typescript
// app/lib/__tests__/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '../example';

describe('myFunction', () => {
  beforeEach(() => {
    // Setup code
  });

  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Component Tests

```typescript
// app/components/__tests__/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(
      <Provider store={store}>
        <MyComponent />
      </Provider>
    );
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### API Tests with MSW

```typescript
// app/store/__tests__/api.test.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('should call API endpoint', async () => {
  server.use(
    http.post('http://localhost:8000/api/endpoint/', () => {
      return HttpResponse.json({ success: true });
    })
  );

  // Your test code
});
```

## CI/CD Integration

Tests run automatically on every push to `main` and `dev` branches:

1. **Lint Check** - ESLint validation
2. **Unit Tests** - All test suites must pass
3. **Coverage Report** - Uploaded to CodeCov
4. **Build** - Next.js build (only if tests pass)
5. **Deploy** - AWS ECS deployment (only if build succeeds)

### GitHub Actions Workflow

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
      - name: Setup Node.js
      - name: Install dependencies
      - name: Run linting
      - name: Run unit tests
      - name: Upload coverage

  deploy:
    needs: test  # Deploy only if tests pass
    runs-on: ubuntu-latest
    steps:
      # ... deployment steps
```

## Test Configuration

### vitest.config.ts

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'app/types/**',
        'app/data/**',
      ],
    },
  },
});
```

### vitest.setup.ts

Global test setup including:
- Automatic cleanup after each test
- Next.js router mocks
- Browser API mocks (matchMedia, IntersectionObserver, ResizeObserver)
- LocalStorage auto-clear

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on user-facing behavior
   - Avoid testing internal implementation details

2. **Use Testing Library Queries**
   - Prefer `getByRole`, `getByLabelText` over `getByTestId`
   - Query elements the way users would

3. **Mock External Dependencies**
   - Mock API calls with MSW
   - Mock Next.js router
   - Mock localStorage/sessionStorage

4. **Keep Tests Fast**
   - Avoid unnecessary `await` delays
   - Use `vi.useFakeTimers()` for time-dependent code

5. **Clean Up After Tests**
   - Clear mocks: `vi.clearAllMocks()`
   - Clear storage: `localStorage.clear()`
   - Reset API state: `store.dispatch(api.util.resetApiState())`

## Debugging Tests

```bash
# Run specific test file
npm run test session.test.ts

# Run tests matching pattern
npm run test -- --grep="login"

# Run with UI for debugging
npm run test:ui
```

## Future Enhancements

- [ ] Increase coverage to 80%+ across all modules
- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Add performance benchmarks
- [ ] Enable coverage thresholds in CI

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
