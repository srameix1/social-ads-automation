import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Variable de entorno requerida no encontrada: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '4000')),

  DB: {
    host:     optional('DB_HOST', 'localhost'),
    port:     parseInt(optional('DB_PORT', '5432')),
    name:     optional('DB_NAME', 'social_ads_db'),
    user:     optional('DB_USER', 'social_ads_user'),
    password: optional('DB_PASSWORD', 'changeme'),
  },

  JWT_SECRET:     required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

  ENCRYPTION_KEY: required('ENCRYPTION_KEY'),

  DATABASE_URL: optional('DATABASE_URL', ''),

  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY', ''),

  GEMINI_API_KEY: optional('GEMINI_API_KEY', ''),

  NANABANANA_API_URL: optional('NANABANANA_API_URL', ''),
  NANABANANA_API_KEY: optional('NANABANANA_API_KEY', ''),

  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:3000'),
  UPLOADS_DIR:  optional('UPLOADS_DIR', './uploads'),
  MAX_FILE_SIZE: parseInt(optional('MAX_FILE_SIZE_MB', '10')) * 1024 * 1024,
} as const;
