import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const testWindow =
  typeof window === 'undefined' ? (globalThis as typeof globalThis & Window) : window;

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: testWindow,
  });
}

const windowEvents = new EventTarget();

if (typeof testWindow.addEventListener !== 'function') {
  Object.defineProperty(testWindow, 'addEventListener', {
    configurable: true,
    value: windowEvents.addEventListener.bind(windowEvents),
  });
}

if (typeof testWindow.removeEventListener !== 'function') {
  Object.defineProperty(testWindow, 'removeEventListener', {
    configurable: true,
    value: windowEvents.removeEventListener.bind(windowEvents),
  });
}

if (typeof testWindow.dispatchEvent !== 'function') {
  Object.defineProperty(testWindow, 'dispatchEvent', {
    configurable: true,
    value: windowEvents.dispatchEvent.bind(windowEvents),
  });
}

function createStorageMock(): Storage {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
  };
}

const localStorageMock = createStorageMock();

Object.defineProperty(testWindow, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window.matchMedia
Object.defineProperty(testWindow, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
