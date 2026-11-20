/**
 * Environment for `scripts/demo-seed.ts`, imported before anything that
 * loads AppModule (its config is read at import time). It seeds the local
 * development database (`.env.local`, then `.env`, as the app reads them),
 * with jobs run in-process so the seed can wait for them, real file storage
 * (MinIO), and no rate limits.
 */
process.env.NODE_ENV ??= 'development';
process.env.QUEUE_DRIVER = 'inline';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.LOG_LEVEL ??= 'warn';
