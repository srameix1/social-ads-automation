// Se ejecuta antes de instalar el test framework en cada worker de Jest,
// en el mismo proceso que corre los tests — por eso mutar process.env acá
// es visible para todo lo que se importe después (incluido src/config/env.ts).
process.env.NODE_ENV = 'test';
