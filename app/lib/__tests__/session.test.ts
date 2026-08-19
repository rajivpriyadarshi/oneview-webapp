import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeAuthToken,
  getStoredAuthToken,
  clearAuthToken,
  storeAdvisorProfile,
  getStoredAdvisorProfile,
  clearAdvisorProfile,
} from '../session';
import type { CRMAdvisor } from '../realAuthApi';

describe('Session Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Auth Token', () => {
    it('should store and retrieve auth token', () => {
      const token = 'test-token-123';
      storeAuthToken(token);
      expect(getStoredAuthToken()).toBe(token);
    });

    it('should return null when no token is stored', () => {
      expect(getStoredAuthToken()).toBeNull();
    });

    it('should clear auth token', () => {
      storeAuthToken('test-token');
      clearAuthToken();
      expect(getStoredAuthToken()).toBeNull();
    });

    it('should overwrite existing token', () => {
      storeAuthToken('old-token');
      storeAuthToken('new-token');
      expect(getStoredAuthToken()).toBe('new-token');
    });
  });

  describe('Advisor Profile', () => {
    const mockAdvisor: CRMAdvisor = {
      id: 1,
      name: 'Test Advisor',
      email: 'advisor@test.com',
      designation: 'Senior RM',
      team: 'HNW Team',
    };

    it('should store and retrieve advisor profile', () => {
      storeAdvisorProfile(mockAdvisor);
      const stored = getStoredAdvisorProfile();
      expect(stored).toEqual(mockAdvisor);
    });

    it('should return null when no advisor profile is stored', () => {
      expect(getStoredAdvisorProfile()).toBeNull();
    });

    it('should clear advisor profile', () => {
      storeAdvisorProfile(mockAdvisor);
      clearAdvisorProfile();
      expect(getStoredAdvisorProfile()).toBeNull();
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('oneview.advisorProfile', 'invalid-json{');
      expect(getStoredAdvisorProfile()).toBeNull();
    });

    it('should overwrite existing advisor profile', () => {
      const oldAdvisor: CRMAdvisor = {
        id: 1,
        name: 'Old Advisor',
        email: 'old@test.com',
        designation: 'Junior RM',
        team: 'Team A',
      };
      storeAdvisorProfile(oldAdvisor);
      storeAdvisorProfile(mockAdvisor);
      expect(getStoredAdvisorProfile()).toEqual(mockAdvisor);
    });
  });

  describe('Integrated Behavior', () => {
    const mockAdvisor: CRMAdvisor = {
      id: 1,
      name: 'Test Advisor',
      email: 'advisor@test.com',
      designation: 'Senior RM',
      team: 'HNW Team',
    };

    it('should clear advisor profile when clearing auth token', () => {
      storeAuthToken('test-token');
      storeAdvisorProfile(mockAdvisor);

      clearAuthToken();

      expect(getStoredAuthToken()).toBeNull();
      expect(getStoredAdvisorProfile()).toBeNull();
    });

    it('should clear userProfile along with auth token', () => {
      storeAuthToken('test-token');
      localStorage.setItem('userProfile', JSON.stringify({ id: 1, name: 'User' }));

      clearAuthToken();

      expect(localStorage.getItem('userProfile')).toBeNull();
    });

    it('should handle complete logout flow', () => {
      // Setup: user is logged in as CRM advisor
      storeAuthToken('crm-token-123');
      storeAdvisorProfile(mockAdvisor);
      localStorage.setItem('userProfile', JSON.stringify({ id: 1 }));

      // Action: logout
      clearAuthToken();

      // Verify: all auth data cleared
      expect(getStoredAuthToken()).toBeNull();
      expect(getStoredAdvisorProfile()).toBeNull();
      expect(localStorage.getItem('userProfile')).toBeNull();
    });
  });
});
