import redis from 'redis';
import config from '../config';
import logger from './logger';

class RedisClient {
  private client: redis.RedisClientType;
  private static instance: RedisClient;

  private constructor() {
    this.client = redis.createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async set(
    key: string,
    value: string,
    options?: { EX?: number; PX?: number; NX?: boolean; XX?: boolean }
  ): Promise<string> {
    return await this.client.set(key, value, options);
  }

  public async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  public async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  public async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  public async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }

  public async hSet(key: string, field: string, value: string): Promise<number> {
    return await this.client.hSet(key, field, value);
  }

  public async hGet(key: string, field: string): Promise<string | null> {
    return await this.client.hGet(key, field);
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    return await this.client.hGetAll(key);
  }

  public async hDel(key: string, ...fields: string[]): Promise<number> {
    return await this.client.hDel(key, ...fields);
  }

  public async lPush(key: string, ...values: string[]): Promise<number> {
    return await this.client.lPush(key, ...values);
  }

  public async rPush(key: string, ...values: string[]): Promise<number> {
    return await this.client.rPush(key, ...values);
  }

  public async lRange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.lRange(key, start, stop);
  }

  public async sAdd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sAdd(key, ...members);
  }

  public async sMembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  public async sIsMember(key: string, member: string): Promise<boolean> {
    return await this.client.sIsMember(key, member);
  }

  public async zAdd(
    key: string,
    score: number,
    member: string
  ): Promise<number> {
    return await this.client.zAdd(key, { score, value: member });
  }

  public async zRange(
    key: string,
    start: number,
    stop: number
  ): Promise<string[]> {
    return await this.client.zRange(key, start, stop);
  }

  public async zRangeWithScores(
    key: string,
    start: number,
    stop: number
  ): Promise<{ value: string; score: number }[]> {
    return await this.client.zRangeWithScores(key, start, stop);
  }

  public async publish(channel: string, message: string): Promise<number> {
    return await this.client.publish(channel, message);
  }

  public async disconnect(): Promise<void> {
    await this.client.quit();
    logger.info('Redis client disconnected');
  }
}

const redisClient = RedisClient.getInstance();

export default redisClient;
export { RedisClient };
