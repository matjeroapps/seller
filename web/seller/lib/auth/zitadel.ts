import type { SellerUser } from './session-cookie';

export interface ZitadelConfig {
  issuer: string;
  internalIssuer: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
}

export interface ZitadelEndpoints {
  authorization: string;
  token: string;
  userinfo: string;
  endSession: string;
  forwardedHost?: string;
  forwardedProto?: string;
}

export type LoginPrompt = 'login' | 'create';

export class SellerAuthorizationError extends Error {
  readonly status = 403;

  constructor(message = 'Authentication bootstrap verification failed') {
    super(message);
    this.name = 'SellerAuthorizationError';
  }
}

export function getZitadelConfig(): ZitadelConfig {
  const issuer = (process.env.ZITADEL_ISSUER || process.env.NEXT_PUBLIC_ZITADEL_ISSUER || 'http://localhost:8081').replace(/\/$/, '');
  const internalIssuer = (process.env.ZITADEL_INTERNAL_ISSUER || issuer).replace(/\/$/, '');
  const clientId = process.env.ZITADEL_CLIENT_ID || process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || '';
  const clientSecret = process.env.ZITADEL_CLIENT_SECRET || '';
  const projectId = process.env.ZITADEL_PROJECT_ID || process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID || '';
  const baseUrl = process.env.NEXT_PUBLIC_SELLER_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  if (!projectId) {
    throw new Error('ZITADEL_PROJECT_ID is required');
  }

  return {
    issuer,
    internalIssuer,
    clientId,
    clientSecret,
    projectId,
    redirectUri: `${baseUrl}/auth/callback`,
    postLogoutRedirectUri: baseUrl,
    scopes: ['openid', 'profile', 'email', `urn:zitadel:iam:org:project:id:${projectId}:aud`]
  };
}

export function getZitadelEndpoints(config: ZitadelConfig): ZitadelEndpoints {
  const base = config.issuer;
  return {
    authorization: `${base}/oauth/v2/authorize`,
    token: `${base}/oauth/v2/token`,
    userinfo: `${base}/oidc/v1/userinfo`,
    endSession: `${base}/oauth/v2/logout`
  };
}

export function getZitadelServerEndpoints(config: ZitadelConfig): ZitadelEndpoints {
  const base = config.internalIssuer || config.issuer;
  const publicIssuerUrl = new URL(config.issuer);
  const internalIssuerUrl = new URL(base);
  const usesInternalTransport = publicIssuerUrl.host !== internalIssuerUrl.host || publicIssuerUrl.protocol !== internalIssuerUrl.protocol;

  return {
    authorization: `${config.issuer}/oauth/v2/authorize`,
    token: `${base}/oauth/v2/token`,
    userinfo: `${base}/oidc/v1/userinfo`,
    endSession: `${config.issuer}/oauth/v2/logout`,
    forwardedHost: usesInternalTransport ? publicIssuerUrl.host : undefined,
    forwardedProto: usesInternalTransport ? publicIssuerUrl.protocol.replace(':', '') : undefined
  };
}

function forwardedIssuerHeaders(endpoints: ZitadelEndpoints): Record<string, string> {
  if (!endpoints.forwardedHost || !endpoints.forwardedProto) {
    return {};
  }

  return {
    'x-forwarded-host': endpoints.forwardedHost,
    'x-forwarded-proto': endpoints.forwardedProto
  };
}

export function getAuthorizationUrl(
  config: ZitadelConfig,
  endpoints: ZitadelEndpoints,
  state: string,
  codeChallenge: string,
  prompt?: LoginPrompt
) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  if (prompt) {
    params.set('prompt', prompt);
  }

  return `${endpoints.authorization}?${params.toString()}`;
}

export function getLogoutUrl(config: ZitadelConfig, endpoints: ZitadelEndpoints) {
  const params = new URLSearchParams({
    post_logout_redirect_uri: config.postLogoutRedirectUri
  });

  return `${endpoints.endSession}?${params.toString()}`;
}

export async function exchangeCodeForTokens(config: ZitadelConfig, endpoints: ZitadelEndpoints, code: string, codeVerifier: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  });

  if (config.clientSecret) {
    params.set('client_secret', config.clientSecret);
  }

  const response = await fetch(endpoints.token, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      ...forwardedIssuerHeaders(endpoints)
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Zitadel token exchange failed with ${response.status}`);
  }

  return response.json() as Promise<{ access_token: string; expires_in?: number }>;
}

export async function fetchUserInfo(endpoints: ZitadelEndpoints, accessToken: string): Promise<SellerUser> {
  const response = await fetch(endpoints.userinfo, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...forwardedIssuerHeaders(endpoints)
    }
  });

  if (!response.ok) {
    throw new Error(`Zitadel userinfo failed with ${response.status}`);
  }

  const userInfo = await response.json();

  return {
    id: String(userInfo.sub || ''),
    email: String(userInfo.email || ''),
    name: String(userInfo.name || userInfo.preferred_username || userInfo.email || 'Seller'),
    avatarUrl: typeof userInfo.picture === 'string' ? userInfo.picture : undefined,
    roles: Object.keys((userInfo['urn:zitadel:iam:org:project:roles'] as Record<string, unknown> | undefined) || {}),
    tenantId: typeof userInfo['urn:zitadel:iam:org:id'] === 'string' ? userInfo['urn:zitadel:iam:org:id'] : undefined
  };
}

export async function verifySellerApiAccess(accessToken: string, expectedSubject: string): Promise<void> {
  const baseUrl = (process.env.SELLER_API_BASE_URL || process.env.NEXT_PUBLIC_SELLER_API_BASE_URL || 'http://127.0.0.1:18081').replace(/\/$/, '');
  const url = `${baseUrl}/v1/bootstrap?locale=en`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`
      }
    });
  } catch {
    throw new Error('Authentication bootstrap verification failed');
  }

  if (!response.ok) {
    const errorText = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
    console.warn('seller auth bootstrap verification failed', { status: response.status, body: errorText });
    if (response.status === 401 || response.status === 403) {
      throw new SellerAuthorizationError();
    }
    throw new Error('Authentication bootstrap verification failed');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Authentication bootstrap verification failed');
  }

  const subject = (payload as { principal?: { subject?: string } })?.principal?.subject;
  if (!subject || typeof subject !== 'string' || subject !== expectedSubject) {
    throw new Error('Authentication bootstrap verification failed');
  }
}
