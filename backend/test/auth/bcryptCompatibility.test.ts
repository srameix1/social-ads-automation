import bcrypt from 'bcrypt';

// Generado con bcrypt 5.1.1 antes de actualizar la dependencia a 6.0.0.
// La entrada es pública y exclusiva de este fixture; no es una credencial real.
const BCRYPT_5_HASH = '$2b$10$mbyTZVlb2lHLg3t.OWgD1u.gc2o8UZTaRrfII/qir4HaBklHkFN6m';
const FIXTURE_PASSWORD = 'bcrypt-v5-compatibility-fixture';

describe('Compatibilidad de hashes bcrypt 5 con bcrypt 6', () => {
  it('verifica un hash generado previamente con bcrypt 5.1.1', async () => {
    await expect(bcrypt.compare(FIXTURE_PASSWORD, BCRYPT_5_HASH)).resolves.toBe(true);
    await expect(bcrypt.compare(`${FIXTURE_PASSWORD}-incorrecta`, BCRYPT_5_HASH)).resolves.toBe(false);
  });
});
