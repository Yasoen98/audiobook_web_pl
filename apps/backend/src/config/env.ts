import 'dotenv/config';

const required = <T extends string | undefined>(value: T, name: string): NonNullable<T> => {
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej: ${name}`);
  }
  return value as NonNullable<T>;
};

export const env = {
  port: Number(process.env.BACKEND_PORT ?? 4000),
  host: process.env.BACKEND_HOST ?? '0.0.0.0',
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
  jwtRefreshSecret: required(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
  redisUrl: required(process.env.REDIS_URL, 'REDIS_URL'),
  minio: {
    endpoint: required(process.env.MINIO_ENDPOINT, 'MINIO_ENDPOINT'),
    accessKey: required(process.env.MINIO_ACCESS_KEY, 'MINIO_ACCESS_KEY'),
    secretKey: required(process.env.MINIO_SECRET_KEY, 'MINIO_SECRET_KEY'),
    bucket: required(process.env.MINIO_BUCKET, 'MINIO_BUCKET')
  },
  ttsServiceUrl: required(process.env.TTS_SERVICE_URL, 'TTS_SERVICE_URL'),
  clamavHost: process.env.CLAMAV_HOST ?? 'clamav',
  clamavPort: Number(process.env.CLAMAV_PORT ?? 3310),
  cspReportOnly: process.env.CSP_REPORT_ONLY === 'true'
};
