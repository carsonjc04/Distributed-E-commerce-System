import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

// Lua script to atomically check stock, decrement, and set a hold key
const RESERVE_STOCK_SCRIPT = `
  local inventoryKey = KEYS[1]
  local holdKey = KEYS[2]
  local ttl = tonumber(ARGV[1])

  -- Check if inventory exists and is greater than 0
  local stock = tonumber(redis.call('get', inventoryKey) or '0')
  
  if stock > 0 then
    -- Decrement inventory
    redis.call('decr', inventoryKey)
    -- Create hold key with TTL
    redis.call('set', holdKey, 'HELD', 'EX', ttl)
    return 1 -- Success
  else
    return 0 -- Fail
  end
`;

export const attemptReserveStock = async (userId: string, productId: string): Promise<boolean> => {
  const inventoryKey = `inventory:${productId}`;
  const holdKey = `hold:${userId}:${productId}`;
  const ttlSeconds = 300; // 5 minutes

  try {
    const result = await redis.eval(
      RESERVE_STOCK_SCRIPT,
      2, // Number of keys
      inventoryKey,
      holdKey,
      ttlSeconds
    );

    return result === 1;
  } catch (error) {
    console.error('Error executing Lua script:', error);
    return false;
  }
};

export const initializeInventory = async (productId: string, count: number) => {
  await redis.set(`inventory:${productId}`, count);
};

export const checkIdempotency = async (key: string): Promise<any | null> => {
  const data = await redis.get(`idempotency:${key}`);
  return data ? JSON.parse(data) : null;
};

export const saveIdempotency = async (key: string, data: any, ttlSeconds: number = 86400) => {
  await redis.set(`idempotency:${key}`, JSON.stringify(data), 'EX', ttlSeconds);
};

export default redis;
