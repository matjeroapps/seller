import { createHash, randomBytes } from 'node:crypto';

export function createState() {
  return randomBytes(24).toString('base64url');
}

export function createCodeVerifier() {
  return randomBytes(32).toString('base64url');
}

export function createCodeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}
