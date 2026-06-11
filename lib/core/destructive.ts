import type { HttpMethod } from './types.js';

const DESTRUCTIVE_PATTERNS = [
  'delete', 'remove', 'archive', 'unenrol', 'unenroll',
  'block', 'reset', 'cancel', 'invalidate',
];

/**
 * An endpoint is destructive if it uses DELETE, or its name/path contains a
 * destructive verb. Conservative on purpose: a false positive only causes an
 * extra confirmation prompt.
 */
export function isDestructive(method: HttpMethod | string, nameOrPath: string): boolean {
  if (String(method).toUpperCase() === 'DELETE') return true;
  const hay = nameOrPath.toLowerCase();
  return DESTRUCTIVE_PATTERNS.some((p) => hay.includes(p));
}
