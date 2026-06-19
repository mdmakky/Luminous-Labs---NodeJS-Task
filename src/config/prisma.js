import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import env from './env.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  // Production-grade pool configuration
  max: 20,                    // max concurrent connections
  idleTimeoutMillis: 30000,   // close idle connections after 30s
  connectionTimeoutMillis: 2000, // error if no connection acquired in 2s
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export { pool };
export default prisma;
