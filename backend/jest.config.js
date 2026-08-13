/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  // Fuerza NODE_ENV=test antes de que cualquier archivo de test importe
  // src/config/env.ts — así env.ts carga .env.test.local y database.ts
  // aplica el chequeo de seguridad de la base de datos.
  setupFiles: ['<rootDir>/test/setup/setTestEnv.js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  clearMocks: true,
};
