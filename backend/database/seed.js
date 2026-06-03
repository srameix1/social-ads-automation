/**
 * Seed de datos de prueba
 * Uso: node seed.js
 * Crea: 1 admin + 1 cliente de prueba "Café del Valle"
 *
 * Admin:   admin@social-ads.com  / Admin1234!
 * Cliente: cliente@prueba.com    / Test1234!
 */
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'social_ads_db',
      user:     process.env.DB_USER     || 'social_ads_user',
      password: process.env.DB_PASSWORD || 'changeme',
    });

const ADMIN_ID  = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';

async function seed() {
  const client = await pool.connect();

  try {
    const adminHash  = await bcrypt.hash('Admin1234!', 10);
    const clientHash = await bcrypt.hash('Test1234!', 10);

    await client.query('BEGIN');

    // Admin
    await client.query(`
      INSERT INTO users (id, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [ADMIN_ID, 'admin@social-ads.com', adminHash]);
    console.log('  ✓ Admin creado: admin@social-ads.com / Admin1234!');

    // Cliente de prueba
    await client.query(`
      INSERT INTO users (id, email, password_hash, role)
      VALUES ($1, $2, $3, 'client')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [CLIENT_ID, 'cliente@prueba.com', clientHash]);
    console.log('  ✓ Cliente creado: cliente@prueba.com / Test1234!');

    // Perfil del cliente
    await client.query(`
      INSERT INTO client_profiles (user_id, business_name, description, setup_completed)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (user_id) DO UPDATE
        SET business_name = EXCLUDED.business_name,
            description   = EXCLUDED.description
    `, [
      CLIENT_ID,
      'Café del Valle',
      'Cafetería artesanal en el centro de la ciudad. Especialidad en café de origen, pasteles caseros y ambiente acogedor para trabajar o reunirse.',
    ]);
    console.log('  ✓ Perfil de Café del Valle creado');

    await client.query('COMMIT');
    console.log('\n✅ Seed completado.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('\n❌ Seed fallido:', err.message);
  process.exit(1);
});
