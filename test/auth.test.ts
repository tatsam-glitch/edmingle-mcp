import { describe, it, expect } from 'vitest';
import { verifyBearerToken } from '../lib/auth.js';

describe('verifyBearerToken', () => {
  it('returns true for a valid token', () => {
    expect(verifyBearerToken('Bearer secret123', 'secret123')).toBe(true);
  });
  it('returns false for an invalid token', () => {
    expect(verifyBearerToken('Bearer wrong', 'secret123')).toBe(false);
  });
  it('returns false for missing Authorization header', () => {
    expect(verifyBearerToken(undefined, 'secret123')).toBe(false);
    expect(verifyBearerToken('', 'secret123')).toBe(false);
  });
  it('returns false for non-Bearer scheme', () => {
    expect(verifyBearerToken('Basic abc123', 'secret123')).toBe(false);
  });
  it('returns false when expected token is empty', () => {
    expect(verifyBearerToken('Bearer anything', '')).toBe(false);
  });
  it('handles length mismatch without throwing', () => {
    expect(verifyBearerToken('Bearer short', 'a-much-longer-expected-token')).toBe(false);
    expect(verifyBearerToken('Bearer a-much-longer-provided-token', 'short')).toBe(false);
  });
});
