import { RedisOptions } from 'bullmq';
import { URL } from 'url';

export const createBullMQConnection = (redisUrl: string): RedisOptions => {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace('/', '')) : 0
  };
};
