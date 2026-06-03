import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../../config/database';
import { env } from '../../config/env';
import { createError } from '../../middleware/errorHandler';

export interface AuthUser {
  id:         string;
  email:      string;
  role:       'client' | 'admin';
  is_active:  boolean;
  created_at: string;
}

export interface LoginResult {
  token: string;
  user:  AuthUser;
}

export async function register(email: string, password: string): Promise<LoginResult> {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) throw createError('Ya existe una cuenta con ese correo', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await query<AuthUser>(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'client')
     RETURNING id, email, role, is_active, created_at`,
    [email, passwordHash],
  );

  await query(
    `INSERT INTO client_profiles (user_id, business_name)
     VALUES ($1, '')`,
    [user.id],
  );

  const token = signToken(user);
  return { token, user };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const row = await queryOne<AuthUser & { password_hash: string }>(
    'SELECT id, email, role, is_active, created_at, password_hash FROM users WHERE email = $1',
    [email],
  );

  if (!row) throw createError('Credenciales incorrectas', 401);
  if (!row.is_active) throw createError('Cuenta desactivada', 403);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw createError('Credenciales incorrectas', 401);

  const { password_hash: _, ...user } = row;
  const token = signToken(user);
  return { token, user };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await queryOne<AuthUser>(
    'SELECT id, email, role, is_active, created_at FROM users WHERE id = $1',
    [userId],
  );
  if (!user) throw createError('Usuario no encontrado', 404);
  return user;
}

function signToken(user: AuthUser): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}
