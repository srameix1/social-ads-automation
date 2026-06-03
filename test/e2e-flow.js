/**
 * Prueba de flujo completo — social-ads-automation
 *
 * Simula el ciclo completo de un cliente de prueba:
 *   1. Registro
 *   2. Setup de perfil
 *   3. Guardado de credenciales (ficticias)
 *   4. Creación de campaña (llama a Claude real si hay API key)
 *   5. Selección de estrategia
 *   6. Verificación de publicaciones
 *   7. Admin: verificar cliente y campaña
 *
 * Uso:
 *   node test/e2e-flow.js
 *
 * Requiere: backend corriendo en http://localhost:4000
 */

const API = 'http://localhost:4000/api';
let PASS = 0, FAIL = 0;

// ── Helpers ────────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function ok(label, condition, info = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    PASS++;
  } else {
    console.log(`  ❌ ${label}${info ? ' — ' + info : ''}`);
    FAIL++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function testHealthCheck() {
  section('1. Health Check');
  const res = await fetch(`${API.replace('/api', '')}/health`);
  const data = await res.json();
  ok('Backend responde', res.status === 200);
  ok('Status OK', data.status === 'ok');
}

async function testRegistration() {
  section('2. Registro de cliente de prueba');
  const email = `test-${Date.now()}@prueba.com`;
  const { status, data } = await req('POST', '/auth/register', {
    email,
    password: 'Test1234!',
  });
  ok('Registro exitoso (201)', status === 201, JSON.stringify(data.error));
  ok('Token recibido', !!data.token);
  ok('Role = client', data.user?.role === 'client');
  return { token: data.token, userId: data.user?.id, email };
}

async function testAdminLogin() {
  section('3. Login de administrador');
  const { status, data } = await req('POST', '/auth/login', {
    email:    'admin@social-ads.com',
    password: 'Admin1234!',
  });
  ok('Login exitoso', status === 200, JSON.stringify(data.error));
  ok('Role = admin', data.user?.role === 'admin');
  return data.token;
}

async function testProfileSetup(token) {
  section('4. Setup de perfil del cliente');

  const { status: s1, data: d1 } = await req('PUT', '/clients/profile', {
    business_name: 'Café del Valle Test',
    description:   'Cafetería artesanal de prueba. Café de origen, ambiente acogedor.',
  }, token);
  ok('Perfil actualizado (200)', s1 === 200, JSON.stringify(d1.error));
  ok('Nombre guardado', d1.profile?.business_name === 'Café del Valle Test');

  const { status: s2, data: d2 } = await req('GET', '/clients/profile', null, token);
  ok('Perfil obtenido', s2 === 200);
  ok('Datos consistentes', d2.profile?.business_name === 'Café del Valle Test');
}

async function testCredentials(token) {
  section('5. Credenciales cifradas de redes sociales');

  const fakeInstagramCreds = {
    access_token:          'EAAMock1234567890',
    instagram_account_id:  '1234567890',
  };
  const { status: s1, data: d1 } = await req('POST', '/credentials/instagram', fakeInstagramCreds, token);
  ok('Credenciales Instagram guardadas (200)', s1 === 200, JSON.stringify(d1.error));

  const fakeTikTokCreds = {
    access_token: 'TikTokMockToken',
    open_id:      'tiktok_user_123',
  };
  const { status: s2, data: d2 } = await req('POST', '/credentials/tiktok', fakeTikTokCreds, token);
  ok('Credenciales TikTok guardadas (200)', s2 === 200, JSON.stringify(d2.error));

  const { status: s3, data: d3 } = await req('GET', '/credentials', null, token);
  ok('Lista de credenciales obtenida', s3 === 200);
  const instagramStatus = d3.credentials?.find(c => c.platform === 'instagram');
  ok('Instagram aparece como conectado', instagramStatus?.connected === true);
}

async function testCampaignCreation(token) {
  section('6. Creación de campaña (llama a Claude API)');
  console.log('  ⏳ Esto puede tomar 30-60 segundos (Claude generando estrategias)...');

  const { status, data } = await req('POST', '/campaigns', {
    title:           'Campaña de prueba E2E — Menú de verano',
    objective:       'Aumentar ventas de nuevas bebidas frías en verano',
    target_audience: 'Adultos 25-40 años que buscan cafeterías con ambiente para trabajar',
    platforms:       ['instagram', 'facebook'],
  }, token);

  ok('Campaña creada (201)', status === 201, JSON.stringify(data.error));

  if (status !== 201) return null;

  const campaign = data.campaign;
  ok('Tiene ID', !!campaign?.id);
  ok('Status correcto', ['pending_selection', 'generating', 'failed'].includes(campaign?.status));

  if (campaign?.status === 'pending_selection') {
    ok('3 estrategias generadas', campaign?.strategies?.length === 3);
    ok('Estrategia 1 tiene título', !!campaign?.strategies?.[0]?.title);
    ok('Estrategia 1 tiene copy_text', !!campaign?.strategies?.[0]?.copy_text);
    ok('Estrategia 1 tiene visual_concept', !!campaign?.strategies?.[0]?.visual_concept);
  } else if (campaign?.status === 'failed') {
    console.log(`  ⚠️  Claude falló (verifica ANTHROPIC_API_KEY): ${campaign?.error_message}`);
  } else {
    console.log(`  ⏳ Status: ${campaign?.status} — esperando...`);
  }

  return campaign;
}

async function testStrategySelection(token, campaign) {
  section('7. Selección de estrategia');

  if (!campaign || campaign.status !== 'pending_selection') {
    console.log('  ⚠️  Saltando: campaña no está en pending_selection');
    return;
  }

  const strategy = campaign.strategies[0];
  const { status, data } = await req(
    'POST',
    `/campaigns/${campaign.id}/strategies/${strategy.id}/select`,
    null, token,
  );
  ok('Estrategia seleccionada (200)', status === 200, JSON.stringify(data.error));

  // Esperar a que el proceso asíncrono complete (NanaBanana placeholder es rápido)
  console.log('  ⏳ Esperando procesamiento de media y publicación (10s)...');
  await sleep(10000);

  const { status: s2, data: d2 } = await req('GET', `/campaigns/${campaign.id}`, null, token);
  ok('Campaña actualizada', s2 === 200);

  const updatedCampaign = d2.campaign;
  ok(
    `Status avanzó (actual: ${updatedCampaign?.status})`,
    ['creating_media', 'publishing', 'completed', 'failed'].includes(updatedCampaign?.status),
  );

  return updatedCampaign;
}

async function testPublications(token, campaign) {
  section('8. Verificación de publicaciones');

  if (!campaign) { console.log('  ⚠️  Saltando: no hay campaña'); return; }

  const { status, data } = await req('GET', `/campaigns/${campaign.id}/publications`, null, token);
  ok('Publicaciones obtenidas (200)', status === 200, JSON.stringify(data.error));

  const pubs = data.publications ?? [];
  console.log(`  ℹ️  Publicaciones encontradas: ${pubs.length}`);

  for (const pub of pubs) {
    const statusLabel = pub.status === 'published' ? '✅ publicado' : pub.status === 'failed' ? '❌ error' : '⏳ pendiente';
    console.log(`     ${pub.platform}: ${statusLabel}${pub.post_url ? ' → ' + pub.post_url : ''}`);
    if (pub.status === 'failed') {
      console.log(`       Error: ${pub.error_message}`);
    }
  }
}

async function testAdminViews(adminToken, clientEmail, campaignId) {
  section('9. Panel de administrador');

  const { status: s1, data: d1 } = await req('GET', '/admin/stats', null, adminToken);
  ok('Stats obtenidas (200)', s1 === 200);
  ok('Total clientes > 0', (d1.totalClients ?? 0) > 0);

  const { status: s2, data: d2 } = await req('GET', '/admin/clients', null, adminToken);
  ok('Lista de clientes (200)', s2 === 200);
  const found = d2.clients?.some(c => c.email === clientEmail);
  ok(`Cliente de prueba visible en admin`, !!found);

  const { status: s3, data: d3 } = await req('GET', '/admin/campaigns', null, adminToken);
  ok('Lista de campañas (200)', s3 === 200);

  if (campaignId) {
    const { status: s4 } = await req('GET', `/admin/campaigns/${campaignId}`, null, adminToken);
    ok('Detalle de campaña (200)', s4 === 200);
  }
}

async function testIsolation(token1, token2) {
  section('10. Aislamiento de datos entre clientes');

  // token2 intenta acceder a campañas de token1 (debe devolver vacío, no error)
  const { status, data } = await req('GET', '/campaigns', null, token2);
  ok('Cliente 2 no ve campañas de cliente 1', status === 200 && data.campaigns?.length === 0);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪 Iniciando pruebas E2E — social-ads-automation');
  console.log(`   API: ${API}\n`);

  try {
    await testHealthCheck();

    const { token: clientToken, userId, email } = await testRegistration();
    if (!clientToken) { console.log('\n❌ Registro falló, abortando.'); return; }

    const adminToken = await testAdminLogin();

    await testProfileSetup(clientToken);
    await testCredentials(clientToken);

    const campaign = await testCampaignCreation(clientToken);
    const updatedCampaign = await testStrategySelection(clientToken, campaign);
    await testPublications(clientToken, updatedCampaign ?? campaign);

    // Segundo cliente para test de aislamiento
    const { token: client2Token } = await (async () => {
      const { data } = await req('POST', '/auth/register', {
        email: `test2-${Date.now()}@prueba.com`, password: 'Test1234!',
      });
      return { token: data.token };
    })();
    await testIsolation(clientToken, client2Token);

    await testAdminViews(adminToken, email, campaign?.id);

  } catch (err) {
    console.error('\n💥 Error inesperado:', err.message);
    FAIL++;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`  RESULTADO: ${PASS} pasaron ✅   ${FAIL} fallaron ❌`);
  console.log('═'.repeat(50) + '\n');

  process.exit(FAIL > 0 ? 1 : 0);
}

main();
