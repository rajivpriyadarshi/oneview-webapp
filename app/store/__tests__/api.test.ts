// @vitest-environment node

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { store } from '../store';
import { api } from '../api';
import type { CRMAuthSession } from '../../lib/realAuthApi';

// Mock the config to use a test URL
vi.mock('../../lib/config', () => ({
  appConfig: {
    apiBaseUrl: 'http://localhost:8000',
    appEnv: 'test',
    googleClientId: '',
    mixpanelToken: '',
    aiAgentSlug: 'test-agent',
    replySuggestionsAutoSubmit: false,
  },
}));

// Create MSW server
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  store.dispatch(api.util.resetApiState());
});
afterAll(() => server.close());

describe('CRM API Endpoints', () => {
  describe('crmLogin', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse: CRMAuthSession = {
        token: 'crm-token-123',
        advisor: {
          id: 1,
          name: 'John Doe',
          email: 'john@test.com',
          designation: 'Senior RM',
          team: 'HNW Team',
        },
      };

      server.use(
        http.post('http://localhost:8000/crm/login/', () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogin.initiate({
          email: 'john@test.com',
          password: 'password123',
        })
      );

      expect(result.data).toEqual(mockResponse);
      expect(result.data?.token).toBe('crm-token-123');
      expect(result.data?.advisor.name).toBe('John Doe');
    });

    it('should handle invalid credentials error', async () => {
      server.use(
        http.post('http://localhost:8000/crm/login/', () => {
          return HttpResponse.json(
            { error: 'Invalid email or password.' },
            { status: 401 }
          );
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogin.initiate({
          email: 'wrong@test.com',
          password: 'wrongpass',
        })
      );

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(401);
    });

    it('should handle missing email/password error', async () => {
      server.use(
        http.post('http://localhost:8000/crm/login/', () => {
          return HttpResponse.json(
            { error: 'Email and password are required.' },
            { status: 400 }
          );
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogin.initiate({
          email: '',
          password: '',
        })
      );

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(400);
    });

    it('should handle non-RM account error', async () => {
      server.use(
        http.post('http://localhost:8000/crm/login/', () => {
          return HttpResponse.json(
            { error: 'This account is not linked to a Relationship Manager profile.' },
            { status: 403 }
          );
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogin.initiate({
          email: 'user@test.com',
          password: 'password123',
        })
      );

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
    });

    it('should handle network errors', async () => {
      server.use(
        http.post('http://localhost:8000/crm/login/', () => {
          return HttpResponse.error();
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogin.initiate({
          email: 'test@test.com',
          password: 'password',
        })
      );

      expect(result.error).toBeDefined();
    });
  });

  describe('crmLogout', () => {
    it('should successfully logout', async () => {
      const mockResponse = { message: 'Logged out.' };

      // Mock localStorage to have a token
      localStorage.setItem('oneview.authToken', 'test-token');

      server.use(
        http.post('http://localhost:8000/crm/logout/', ({ request }) => {
          // Verify Authorization header is present
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Token ')) {
            return HttpResponse.json(
              { error: 'Authentication credentials were not provided.' },
              { status: 401 }
            );
          }
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogout.initiate()
      );

      expect(result.data).toEqual(mockResponse);
      expect(result.data?.message).toBe('Logged out.');
    });

    it('should handle logout without token (401)', async () => {
      server.use(
        http.post('http://localhost:8000/crm/logout/', () => {
          return HttpResponse.json(
            { error: 'Authentication credentials were not provided.' },
            { status: 401 }
          );
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogout.initiate()
      );

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(401);
    });
  });

  describe('Response Data Structure', () => {
    it('should return advisor with all required fields', async () => {
      const mockResponse: CRMAuthSession = {
        token: 'token-abc',
        advisor: {
          id: 5,
          name: 'Jane Smith',
          email: 'jane@example.com',
          designation: 'Relationship Manager',
          team: 'UHNW - Singapore',
        },
      };

      server.use(
        http.post('http://localhost:8000/crm/login/', () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await store.dispatch(
        api.endpoints.crmLogin.initiate({
          email: 'jane@example.com',
          password: 'pass',
        })
      );

      const advisor = result.data?.advisor;
      expect(advisor).toBeDefined();
      expect(advisor).toHaveProperty('id');
      expect(advisor).toHaveProperty('name');
      expect(advisor).toHaveProperty('email');
      expect(advisor).toHaveProperty('designation');
      expect(advisor).toHaveProperty('team');
    });
  });
});
