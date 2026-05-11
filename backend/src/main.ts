import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Redis from 'ioredis';
import { AppModule } from './app.module';

function redisOptionsFromEnv(): { host: string; port: number; password?: string } {
  const host = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT?.trim() || '6379');
  const raw = process.env.REDIS_PASSWORD?.trim();
  const password = raw ? raw : undefined;
  return { host, port, password };
}

/** One-shot ping so the terminal shows whether Redis is up for BullMQ. */
async function logRedisStatus(): Promise<void> {
  const { host, port, password } = redisOptionsFromEnv();
  const redis = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 3000,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong === 'PONG') {
      console.log(
        `Redis is running at ${host}:${port} — BullMQ (fraud queue) is connected.`,
      );
    }
  } catch {
    console.warn(
      `Redis is not reachable at ${host}:${port}. Start Redis (from repo root: docker compose up -d) so payment fraud jobs can run.`,
    );
  } finally {
    redis.disconnect();
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Server is running on port  http://localhost:${process.env.PORT ?? 3000}`);
  await logRedisStatus();
}
bootstrap();
