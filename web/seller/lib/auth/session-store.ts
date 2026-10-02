import crypto from 'node:crypto';
import Redis from 'ioredis';

export interface ActorSessionData {
  sessionId: string;
  sub: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp ms
}

const MEMORY_SESSION_STORE = new Map<string, ActorSessionData>();

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || (process.env.REDIS_ADDR ? `redis://${process.env.REDIS_ADDR}` : null);
  if (redisUrl && process.env.NODE_ENV !== 'test') {
    try {
      redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
      });
    } catch {
      redisClient = null;
    }
  }

  return redisClient;
}

const SESSION_PREFIX = 'seller:session:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export async function createActorSession(
  data: Omit<ActorSessionData, 'sessionId'>
): Promise<ActorSessionData> {
  const sessionId = crypto.randomUUID();
  const session: ActorSessionData = {
    ...data,
    sessionId,
  };

  const redis = getRedisClient();
  if (redis) {
    try {
      const ttlSeconds = Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000)) || DEFAULT_TTL_SECONDS;
      await redis.setex(`${SESSION_PREFIX}${sessionId}`, ttlSeconds, JSON.stringify(session));
      return session;
    } catch {
      // Fallback to memory store if Redis is unreachable
    }
  }

  MEMORY_SESSION_STORE.set(sessionId, session);
  return session;
}

export async function getActorSession(sessionId: string): Promise<ActorSessionData | null> {
  if (!sessionId) {
    return null;
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
      if (!data) {
        return null;
      }

      const parsed: ActorSessionData = JSON.parse(data);
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        await redis.del(`${SESSION_PREFIX}${sessionId}`);
        return null;
      }

      return parsed;
    } catch {
      // Fallback to memory store
    }
  }

  const memorySession = MEMORY_SESSION_STORE.get(sessionId);
  if (!memorySession) {
    return null;
  }

  if (memorySession.expiresAt && memorySession.expiresAt < Date.now()) {
    MEMORY_SESSION_STORE.delete(sessionId);
    return null;
  }

  return memorySession;
}

export async function destroyActorSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    return;
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(`${SESSION_PREFIX}${sessionId}`);
    } catch {
      // ignore fallback
    }
  }

  MEMORY_SESSION_STORE.delete(sessionId);
}

export function clearMemoryStore(): void {
  MEMORY_SESSION_STORE.clear();
}
