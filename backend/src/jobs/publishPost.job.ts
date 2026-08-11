import { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../config/database';
import { getBoss } from '../config/pgboss';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getDecryptedCredentials } from '../modules/credentials/credentials.service';
import {
  createInstagramContainer,
  checkInstagramContainerStatus,
  publishInstagramContainer,
  InstagramCredentials,
} from '../services/instagram.service';
import { publishToTikTok, checkTikTokPublishStatus, TikTokCredentials, TikTokMediaType } from '../services/tiktok.service';
import { publishToFacebook } from '../services/facebook.service';

type Boss = Awaited<ReturnType<typeof getBoss>>;

// Reintentos manuales del chequeo de estado de TikTok (no los maneja pg-boss,
// porque cada intento "tiene éxito" — solo nos dice si hay que seguir esperando).
// Backoff exponencial con techo de 5 min entre chequeos, hasta cubrir varias horas.
const TIKTOK_MAX_ATTEMPTS             = 60;
const TIKTOK_CHECK_BACKOFF_BASE_SECS  = 15;
const TIKTOK_CHECK_BACKOFF_CAP_SECS   = 300;

// Reintentos del chequeo de estado de Instagram — a diferencia de TikTok, acá
// el intervalo es fijo (no exponencial): el procesamiento de Reels suele ser
// más predecible y corto que la moderación de TikTok. 20 intentos × 30s = 10 min.
const INSTAGRAM_CHECK_INITIAL_DELAY_SECS = 30;
const INSTAGRAM_CHECK_INTERVAL_SECS      = 30;
const INSTAGRAM_CHECK_MAX_ATTEMPTS       = 20;

// Subconjunto de Post (posts.service.ts) — se define localmente para evitar
// un import circular entre posts.service.ts y este archivo.
interface ConfirmedPost {
  id:                  string;
  campaign_id:         string;
  strategy_id:         string | null;
  visual_variation_id: string | null;
  platforms:           string[];
  format:              'image' | 'animated_video' | 'reel';
}

interface PublishJobData {
  publicationId: string;
  clientId:      string;
  platform:      string;
  mediaUrl:      string;
  caption:       string;
  mediaType:     TikTokMediaType;
}

interface TikTokCheckJobData {
  publicationId: string;
  clientId:      string;
  publishId:     string;
  openId:        string;
  mediaType:     TikTokMediaType;
  attempt:       number;
}

interface InstagramCheckJobData {
  publicationId:       string;
  clientId:            string;
  containerId:         string;
  // No la usa el chequeo en sí (el container ya la lleva incrustada desde la
  // creación) — se guarda en el job data para que quede visible en la tabla
  // de pg-boss si hay que revisar manualmente un job atascado.
  caption:             string;
  instagramAccountId:  string;
  attempt:             number;
}

// ── Encolar (llamado desde confirmPost) ────────────────────────────────────
// Reemplaza el setImmediate(() => publishConfirmedPost(...)) fire-and-forget:
// la fila 'pending' + el job quedan escritos en Postgres antes de devolver
// la respuesta al cliente, así que sobreviven un reinicio del servidor.
//
// Idempotente por (internal_post_id, platform): si confirmPost() se reintenta
// después de que esta función falló a mitad de camino (algunas plataformas
// ya encoladas, otras no), no debe duplicar las que ya quedaron 'pending'/
// 'processing'/'published'. El SELECT previo cubre el caso normal (reintento
// secuencial); el ON CONFLICT contra el índice único parcial
// idx_publications_post_platform_active (migración 026) cubre la ventana de
// carrera si dos confirmaciones llegan casi simultáneas. Cada plataforma se
// procesa en su propia transacción para que, si boss.send() falla después
// del INSERT, el rollback deshaga esa fila en vez de dejarla huérfana.

export async function enqueuePublishJobs(
  post:         ConfirmedPost,
  clientId:     string,
  variationUrl: string | null,
): Promise<void> {
  let mediaUrl = variationUrl;
  if (!mediaUrl) {
    const variation = await queryOne<{ url: string | null }>(
      'SELECT url FROM visual_variations WHERE id = $1',
      [post.visual_variation_id],
    );
    mediaUrl = variation?.url ?? null;
  }
  if (!mediaUrl) {
    logger.error(`[enqueuePublishJobs] No hay media URL para post ${post.id}, se aborta publicación automática`);
    return;
  }
  if (!post.strategy_id) {
    logger.error(`[enqueuePublishJobs] Post ${post.id} no tiene strategy_id, se aborta publicación automática`);
    return;
  }

  const strategy = await queryOne<{ copy_text: string }>(
    'SELECT copy_text FROM strategies WHERE id = $1',
    [post.strategy_id],
  );
  const caption = strategy?.copy_text ?? '';
  const absoluteMediaUrl = mediaUrl.startsWith('/') ? `${env.BACKEND_URL}${mediaUrl}` : mediaUrl;
  const mediaType: TikTokMediaType = post.format === 'image' ? 'image' : 'video';

  const boss = await getBoss();

  // Cada plataforma se procesa de forma independiente: un fallo en una (ej.
  // Instagram) no debe impedir que se intenten las demás (ej. Facebook,
  // TikTok), igual que hacía publishConfirmedPost con su try/catch por
  // iteración. El fallo no se traga en silencio — se acumula y, si hubo al
  // menos uno, se lanza al final para que confirmPost se entere.
  const failedPlatforms: string[] = [];

  for (const platform of post.platforms) {
    try {
      await withTransaction(async (dbClient: PoolClient): Promise<void> => {
        const existing = await dbClient
          .query<{ id: string }>(
            `SELECT id FROM publications
             WHERE internal_post_id = $1 AND platform = $2
               AND status IN ('pending', 'processing', 'published')
             LIMIT 1`,
            [post.id, platform],
          )
          .then((r) => r.rows[0]);

        if (existing) {
          logger.info(
            `[enqueuePublishJobs] ${platform} ya tiene publication ${existing.id} activa para post ${post.id}, se omite duplicado`,
          );
          return;
        }

        const publication = await dbClient
          .query<{ id: string }>(
            `INSERT INTO publications (internal_post_id, campaign_id, strategy_id, platform, status)
             VALUES ($1, $2, $3, $4, 'pending')
             ON CONFLICT (internal_post_id, platform)
               WHERE status IN ('pending', 'processing', 'published')
             DO NOTHING
             RETURNING id`,
            [post.id, post.campaign_id, post.strategy_id, platform],
          )
          .then((r) => r.rows[0]);

        if (!publication) {
          logger.info(
            `[enqueuePublishJobs] ${platform} ya tiene publication activa para post ${post.id} (detectada por índice único al insertar), se omite duplicado`,
          );
          return;
        }

        const data: PublishJobData = {
          publicationId: publication.id, clientId, platform, mediaUrl: absoluteMediaUrl, caption, mediaType,
        };
        // Si boss.send() lanza acá, withTransaction hace ROLLBACK del INSERT de
        // arriba: no queda una fila 'pending' huérfana sin job real detrás.
        const jobId = await boss.send('publish-post', data);

        if (jobId) {
          await dbClient.query('UPDATE publications SET pgboss_job_id = $1 WHERE id = $2', [jobId, publication.id]);
        }

        logger.info(`[enqueuePublishJobs] Encolado publish-post para post ${post.id} / ${platform} (publicationId=${publication.id})`);
      });
    } catch (err) {
      logger.error(
        `[enqueuePublishJobs] Falló el encolado de ${platform} para post ${post.id}: ${(err as Error).message}`,
      );
      failedPlatforms.push(platform);
    }
  }

  if (failedPlatforms.length > 0) {
    throw new Error(
      `Falló el encolado de publicación para: ${failedPlatforms.join(', ')} (post ${post.id})`,
    );
  }
}

// ── Worker: publish-post ────────────────────────────────────────────────────

async function handlePublishPost(jobs: Array<{ data: PublishJobData }>): Promise<void> {
  const { publicationId, clientId, platform, mediaUrl, caption, mediaType } = jobs[0].data;

  // Si la fila ya está en 'processing' cuando pg-boss nos entrega este job, es
  // un reintento tras un fallo a mitad de camino (ej. el servidor se reinició
  // entre el publishTo{platform} real y el UPDATE que lo confirma en DB). No
  // hay forma de saber si esa llamada anterior ya publicó de verdad, así que
  // NO se vuelve a invocar publishTo{platform} — eso arriesgaría publicar dos
  // veces en la cuenta real del cliente, algo que no se puede deshacer. Se
  // marca 'failed' para revisión manual y no se relanza la excepción, para
  // que pg-boss no siga reintentando solo este caso ambiguo.
  const current = await queryOne<{ status: string }>(
    'SELECT status FROM publications WHERE id = $1',
    [publicationId],
  );

  if (current?.status === 'processing') {
    logger.error(
      `[publishPost] publicationId=${publicationId} ya estaba en 'processing' — reintento ambiguo de pg-boss, no se puede confirmar si la publicación en ${platform} ya se ejecutó. Se marca 'failed' para revisión manual en vez de arriesgar un duplicado.`,
    );
    await query(
      "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
      ['Posible duplicado — verificar manualmente si ya se publicó antes de reintentar', publicationId],
    );
    return;
  }

  // true desde el instante en que publishTo{platform} confirma éxito real en
  // la red social. Si algo falla DESPUÉS de eso (el UPDATE de resultado, el
  // sendAfter del chequeo de TikTok), el catch de abajo necesita saberlo para
  // no relanzar y no arriesgar que pg-boss vuelva a publicar un duplicado.
  let alreadyPublished = false;

  try {
    await query("UPDATE publications SET status = 'processing' WHERE id = $1", [publicationId]);
    const creds = await getDecryptedCredentials(clientId, platform as 'instagram' | 'tiktok' | 'facebook');

    if (platform === 'tiktok') {
      const tiktokCreds = creds as unknown as TikTokCredentials;
      // publishToTikTok ya arma un postUrl con publish_id (transaccional, no el ID
      // final del video) — acá solo usamos su postId (== publish_id) y encadenamos
      // el chequeo de estado real en vez de confiar en esa URL.
      const { postId: publishId } = await publishToTikTok(tiktokCreds, mediaUrl, caption, mediaType);
      alreadyPublished = true;
      await query('UPDATE publications SET post_id = $1 WHERE id = $2', [publishId, publicationId]);

      const boss = await getBoss();
      const data: TikTokCheckJobData = {
        publicationId, clientId, publishId, openId: tiktokCreds.open_id, mediaType, attempt: 0,
      };
      await boss.sendAfter('tiktok-check-status', data, null, TIKTOK_CHECK_BACKOFF_BASE_SECS);
      logger.info(`[publishPost] TikTok publish_id=${publishId} — esperando confirmación (publicationId=${publicationId})`);
      return;
    }

    let result: { postId: string; postUrl: string };
    if (platform === 'instagram') {
      const instagramCreds = creds as unknown as InstagramCredentials;
      const { creationId, isVideo } = await createInstagramContainer(instagramCreds, mediaUrl, caption);

      if (isVideo) {
        // Container creado — no se espera acá de forma bloqueante (eso era lo que
        // podía perder el creationId si el timeout de 5 min se cumplía antes de
        // publicar). Se persiste de inmediato y el resto lo maneja
        // instagram-check-status, mismo patrón que TikTok guarda
        // post_id = publishId antes de encolar tiktok-check-status.
        await query('UPDATE publications SET container_id = $1 WHERE id = $2', [creationId, publicationId]);

        const boss = await getBoss();
        const data: InstagramCheckJobData = {
          publicationId, clientId, containerId: creationId, caption,
          instagramAccountId: instagramCreds.instagram_account_id, attempt: 0,
        };
        await boss.sendAfter('instagram-check-status', data, null, INSTAGRAM_CHECK_INITIAL_DELAY_SECS);
        logger.info(`[publishPost] Instagram container=${creationId} — esperando confirmación (publicationId=${publicationId})`);
        return; // alreadyPublished se marca recién cuando instagram-check-status confirme
      }

      // Imagen: no hay procesamiento asíncrono de por medio, se publica directo.
      result = await publishInstagramContainer(instagramCreds, creationId);
    } else if (platform === 'facebook') {
      result = await publishToFacebook(creds as unknown as Parameters<typeof publishToFacebook>[0], mediaUrl, caption);
    } else {
      throw new Error(`Plataforma no soportada: ${platform}`);
    }
    alreadyPublished = true;

    await query(
      `UPDATE publications SET status = 'published', post_id = $1, post_url = $2, published_at = NOW() WHERE id = $3`,
      [result.postId, result.postUrl, publicationId],
    );
    logger.info(`[publishPost] Post publicado en ${platform} (publicationId=${publicationId})`);
  } catch (err) {
    const message = (err as Error).message;

    if (alreadyPublished) {
      // Ya se publicó de verdad en ${platform}; el error ocurrió después (al
      // confirmarlo en DB o al encolar el chequeo de TikTok). Relanzar haría
      // que pg-boss reintente y vuelva a llamar a publishTo{platform},
      // duplicando la publicación real. Se deja para revisión manual.
      logger.error(
        `[publishPost] publicationId=${publicationId} publicó en ${platform} pero falló la confirmación posterior: ${message}. Se marca 'failed' para revisión manual, no se reintenta.`,
      );
      await query(
        "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
        ['Publicación posiblemente exitosa pero no se pudo confirmar en la base de datos — revisar manualmente antes de reintentar', publicationId],
      );
      return; // no relanzar: corta el reintento automático de pg-boss
    }

    await query(
      "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
      [message, publicationId],
    );
    logger.error(`[publishPost] Error publicando (publicationId=${publicationId}): ${message}`);
    throw err; // pg-boss reintenta según retryLimit/retryBackoff configurados en la queue
  }
}

// ── Worker: tiktok-check-status (cadena de sendAfter) ──────────────────────

async function handleTikTokCheckStatus(jobs: Array<{ data: TikTokCheckJobData }>): Promise<void> {
  const { publicationId, clientId, publishId, openId, mediaType, attempt } = jobs[0].data;

  const creds = await getDecryptedCredentials(clientId, 'tiktok') as unknown as TikTokCredentials;
  const result = await checkTikTokPublishStatus(creds, publishId);

  if (result.status === 'PUBLISH_COMPLETE') {
    const postUrl = result.postId
      ? `https://www.tiktok.com/@${openId}/${mediaType === 'image' ? 'photo' : 'video'}/${result.postId}`
      : null;
    await query(
      `UPDATE publications SET status = 'published', post_id = $1, post_url = $2, published_at = NOW() WHERE id = $3`,
      [result.postId, postUrl, publicationId],
    );
    logger.info(`[tiktokCheckStatus] Confirmado — post_id=${result.postId} (publicationId=${publicationId})`);
    return;
  }

  if (result.status === 'FAILED') {
    await query(
      "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
      [result.failReason ?? 'TikTok reportó FAILED al consultar el estado de publicación', publicationId],
    );
    logger.error(`[tiktokCheckStatus] TikTok reportó FAILED (publicationId=${publicationId})`);
    return;
  }

  const nextAttempt = attempt + 1;
  if (nextAttempt >= TIKTOK_MAX_ATTEMPTS) {
    await query(
      "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
      ['Timeout esperando confirmación de TikTok (varias horas sin PUBLISH_COMPLETE)', publicationId],
    );
    logger.error(`[tiktokCheckStatus] Timeout tras ${TIKTOK_MAX_ATTEMPTS} intentos (publicationId=${publicationId})`);
    return;
  }

  const boss = await getBoss();
  const delaySeconds = Math.min(
    TIKTOK_CHECK_BACKOFF_BASE_SECS * 2 ** nextAttempt,
    TIKTOK_CHECK_BACKOFF_CAP_SECS,
  );
  const data: TikTokCheckJobData = { publicationId, clientId, publishId, openId, mediaType, attempt: nextAttempt };
  await boss.sendAfter('tiktok-check-status', data, null, delaySeconds);
  logger.debug(`[tiktokCheckStatus] Sigue en ${result.status} — próximo chequeo en ${delaySeconds}s (intento ${nextAttempt})`);
}

// ── Worker: instagram-check-status (cadena de sendAfter) ───────────────────

async function handleInstagramCheckStatus(jobs: Array<{ data: InstagramCheckJobData }>): Promise<void> {
  const { publicationId, clientId, containerId, caption, instagramAccountId, attempt } = jobs[0].data;

  const creds  = await getDecryptedCredentials(clientId, 'instagram') as unknown as InstagramCredentials;
  const result = await checkInstagramContainerStatus(instagramAccountId, containerId, creds.access_token);

  if (result.statusCode === 'FINISHED') {
    try {
      const { postId, postUrl } = await publishInstagramContainer(creds, containerId);
      await query(
        `UPDATE publications SET status = 'published', post_id = $1, post_url = $2, published_at = NOW() WHERE id = $3`,
        [postId, postUrl, publicationId],
      );
      logger.info(`[instagramCheckStatus] Confirmado y publicado — post_id=${postId} (publicationId=${publicationId})`);
    } catch (err) {
      // Container listo pero media_publish falló acá: no se relanza el error,
      // porque pg-boss reintentaría este job completo y volvería a llamar a
      // publishInstagramContainer sobre un container que quizás ya se publicó
      // — mismo riesgo de duplicado que handlePublishPost evita con
      // alreadyPublished para el resto de las plataformas. Se marca 'failed'
      // para revisión manual — la caption queda en el job data de pg-boss
      // por si hay que reconstruir el post a mano.
      const message = (err as Error).message;
      await query(
        "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
        [message, publicationId],
      );
      logger.error(`[instagramCheckStatus] Container FINISHED pero falló media_publish (publicationId=${publicationId}): ${message}`);
    }
    return;
  }

  if (result.statusCode === 'ERROR') {
    await query(
      "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
      [result.statusText ?? 'Instagram reportó ERROR al procesar el container', publicationId],
    );
    logger.error(`[instagramCheckStatus] Instagram reportó ERROR (publicationId=${publicationId}): ${result.statusText}`);
    return;
  }

  const nextAttempt = attempt + 1;
  if (nextAttempt >= INSTAGRAM_CHECK_MAX_ATTEMPTS) {
    await query(
      "UPDATE publications SET status = 'failed', error_message = $1 WHERE id = $2",
      ['Instagram no confirmó el procesamiento del video en 10 minutos — puede requerir revisión manual', publicationId],
    );
    logger.error(`[instagramCheckStatus] Timeout tras ${INSTAGRAM_CHECK_MAX_ATTEMPTS} intentos (publicationId=${publicationId})`);
    return;
  }

  const boss = await getBoss();
  const data: InstagramCheckJobData = {
    publicationId, clientId, containerId, caption, instagramAccountId, attempt: nextAttempt,
  };
  await boss.sendAfter('instagram-check-status', data, null, INSTAGRAM_CHECK_INTERVAL_SECS);
  logger.debug(`[instagramCheckStatus] Sigue en ${result.statusCode ?? 'sin status_code'} — próximo chequeo en ${INSTAGRAM_CHECK_INTERVAL_SECS}s (intento ${nextAttempt})`);
}

// ── Registro (llamado una vez desde server.ts al iniciar) ─────────────────

export async function registerPublishPostWorker(boss: Boss): Promise<void> {
  await boss.createQueue('publish-post', {
    retryLimit:      5,
    retryBackoff:    true,
    expireInSeconds: 300,
  });
  await boss.createQueue('tiktok-check-status', {
    retryLimit:      3,
    retryBackoff:    true,
    expireInSeconds: 60,
  });
  await boss.createQueue('instagram-check-status', {
    retryLimit:      3,
    retryBackoff:    true,
    expireInSeconds: 60,
  });

  await boss.work('publish-post', handlePublishPost);
  await boss.work('tiktok-check-status', handleTikTokCheckStatus);
  await boss.work('instagram-check-status', handleInstagramCheckStatus);
}
