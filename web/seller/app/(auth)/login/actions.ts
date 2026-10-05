'use server';

import { redirect } from 'next/navigation';

import {
  createCodeChallenge,
  createCodeVerifier,
  createState,
  getAuthorizationUrl,
  getZitadelConfig,
  getZitadelEndpoints,
  setAuthTransaction,
  type LoginPrompt
} from '@/lib/auth';

function normalizeRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/dashboard';
  }

  if (value.startsWith('//')) {
    return '/dashboard';
  }

  return value;
}

export async function startLogin(formData: FormData) {
  const state = createState();
  const codeVerifier = createCodeVerifier();
  const redirectTo = normalizeRedirect(formData.get('redirect'));
  const requestedPrompt = formData.get('prompt');
  const prompt: LoginPrompt | undefined =
    requestedPrompt === 'login' || requestedPrompt === 'create' ? requestedPrompt : undefined;

  await setAuthTransaction({
    state,
    codeVerifier,
    redirectTo
  });

  const config = getZitadelConfig();
  const endpoints = getZitadelEndpoints(config);
  redirect(getAuthorizationUrl(config, endpoints, state, createCodeChallenge(codeVerifier), prompt));
}
