import dotenv from 'dotenv';
import { DEFAULT_MAX_REEL_BYTES } from './defaults';
dotenv.config();

export interface EnvironmentConfig {
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;

  STREAM_CONCURRENCY: number;
  MAX_JOB_LIMIT: number;
  MAX_REEL_BYTES: number;
  STORAGE_PROVIDER: 'gcp' | 'aws';
  FIRESTORE_JOBS_COLLECTION: string;
  CRON_INTERVAL_MS: number;
  LOT_CONCURRENCY: number;
  LOT_MAX_RETRIES: number;
  RENDER_THREADS: number;
  RENDER_TIMEOUT_MS: number;
  RENDERER_VERSION: string;

  SCRATCH_DIR: string;
  THEME_CACHE_DIR: string;

  // Speech-to-text routing
  STT_PROVIDER: 'zoop' | 'groq' | 'openrouter';
  STT_ZOOP_URL: string;
  STT_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL: string;
  OPENROUTER_MODEL: string;

  GCP_PROJECT_ID?: string;
  GCP_SERVICE_ACCOUNT_JSON?: string;
  GCP_SERVICE_ACCOUNT_KEY_PATH?: string;
  AUCTION_REEL_PUBSUB_TOPIC: string;
  REELS_BUCKET: string;
  THEMES_BUCKET: string;

  S3_BUCKET: string;
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  ZOOP_CDN_BASE_URL: string;

  SHARE_LEADERBOARD_URL: string;
  LIVESTREAM_URL: string;
  X_API_SIGN_TOKEN?: string;

  ADMIN_JWT_SECRET: string;
  STREAM_ID?: number;
}

export const env: EnvironmentConfig = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  STREAM_CONCURRENCY: parseInt(process.env.STREAM_CONCURRENCY || '1', 10),
  MAX_JOB_LIMIT: parseInt(process.env.MAX_JOB_LIMIT || '2', 10),
  MAX_REEL_BYTES: parseInt(process.env.MAX_REEL_BYTES || String(DEFAULT_MAX_REEL_BYTES), 10),
  STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER?.toLowerCase() === 'aws' ? 'aws' : 'gcp') as
    'gcp' | 'aws',
  FIRESTORE_JOBS_COLLECTION: process.env.FIRESTORE_JOBS_COLLECTION || 'auction_reels_jobs',
  CRON_INTERVAL_MS: parseInt(process.env.CRON_INTERVAL_MS || '300000', 10), // 5 minutes
  LOT_CONCURRENCY: parseInt(process.env.LOT_CONCURRENCY || '2', 10),
  LOT_MAX_RETRIES: parseInt(process.env.LOT_MAX_RETRIES || '3', 10),
  RENDER_THREADS: parseInt(process.env.RENDER_THREADS || '4', 10),
  RENDER_TIMEOUT_MS: parseInt(process.env.RENDER_TIMEOUT_MS || '300000', 10),
  RENDERER_VERSION: process.env.RENDERER_VERSION || '1.0.0',

  SCRATCH_DIR: process.env.SCRATCH_DIR || '/tmp/auction-reels-scratch',
  THEME_CACHE_DIR: process.env.THEME_CACHE_DIR || '/tmp/reel-themes',

  // Speech-to-text routing
  STT_PROVIDER: (process.env.STT_PROVIDER?.toLowerCase() || 'zoop') as
    'zoop' | 'groq' | 'openrouter',
  STT_ZOOP_URL: process.env.STT_ZOOP_URL || 'http://stt-inference:8000',
  STT_API_KEY: process.env.STT_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL || 'whisper-large-v3-turbo',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openai/whisper-large-v3',

  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
  GCP_SERVICE_ACCOUNT_JSON: process.env.GCP_SERVICE_ACCOUNT_JSON,
  GCP_SERVICE_ACCOUNT_KEY_PATH:
    process.env.GCP_SERVICE_ACCOUNT_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  AUCTION_REEL_PUBSUB_TOPIC: process.env.AUCTION_REEL_PUBSUB_TOPIC || 'auction-reel-events',
  REELS_BUCKET: process.env.REELS_BUCKET || 'zoop-auction-reels-prod',
  THEMES_BUCKET: process.env.THEMES_BUCKET || 'zoop-reel-themes-prod',

  S3_BUCKET: process.env.S3_BUCKET || 'zoop-live-stream-prod-bucket',
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  ZOOP_CDN_BASE_URL: process.env.ZOOP_CDN_BASE_URL || 'https://cdn-prod.zooplive.com',

  SHARE_LEADERBOARD_URL:
    process.env.SHARE_LEADERBOARD_URL || 'http://share-leaderboard-service:8080',
  LIVESTREAM_URL: process.env.LIVESTREAM_URL || 'http://livestream-service:8080',
  X_API_SIGN_TOKEN: process.env.X_API_SIGN_TOKEN,

  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || 'default-admin-secret-change-in-production',
  STREAM_ID: process.env.STREAM_ID ? parseInt(process.env.STREAM_ID, 10) : undefined,
};
