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
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // otplib (2FA) trae @scure/base como dependencia — ESM puro, sin build CJS
  // (package.json: "type":"module", sin campo "exports"). Node 24 lo tolera
  // vía su soporte nativo de require(esm), pero el CJS loader propio de Jest
  // no lo tiene y explota con "Unexpected token 'export'" al toparse con su
  // sintaxis ESM. Se excluye puntualmente de transformIgnorePatterns para
  // que ts-jest lo transpile a CommonJS antes de ejecutarlo — el resto de
  // node_modules se sigue ignorando (más rápido, no lo necesita).
  transformIgnorePatterns: ['/node_modules/(?!@scure)/'],
  clearMocks: true,
  // Todos los archivos de test comparten UNA sola base Postgres real
  // (social_ads_db_test) y cada uno hace truncateAllTables() en su propio
  // beforeEach. Con más de 1 worker, Jest corre archivos en paralelo en
  // procesos distintos — el truncate de un archivo puede borrar filas que
  // otro archivo acaba de insertar a mitad de un test, dando FK violations
  // o logins que fallan por "usuario no encontrado" de forma intermitente.
  // maxWorkers:1 serializa la ejecución de archivos para eliminar la
  // condición de carrera. Si esto se vuelve un cuello de botella real,
  // la alternativa es aislar por schema/DB por worker, no volver a paralelizar.
  maxWorkers: 1,
};
