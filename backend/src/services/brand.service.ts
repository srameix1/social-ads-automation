/**
 * Brand Service — Plan Profesional y Premium
 *
 * Usa Sharp para:
 *   1. Superponer el logo del cliente en la esquina inferior derecha
 *   2. Aplicar una franja de color de marca en la parte inferior
 *   3. (Futuro) Aplicar tipografía personalizada de marca
 *
 * La imagen base viene de Gemini (limpia, sin texto ni logos).
 * Este servicio la transforma en contenido con identidad de marca.
 */

import fs   from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface BrandConfig {
  logoBase64?:       string;   // base64 PNG/JPG del logo
  primaryColor?:     string;   // hex #RRGGBB
  secondaryColor?:   string;   // hex #RRGGBB
  businessName?:     string;   // fallback si no hay logo
}

// ── Punto de entrada principal ─────────────────────────────────────────────

/**
 * Aplica identidad de marca completa a una imagen generada por Gemini.
 * Modifica el archivo en-place.
 */
export async function applyBranding(
  imagePath: string,
  brand:     BrandConfig,
): Promise<void> {
  try {
    const ops: Array<() => Promise<void>> = [];

    if (brand.primaryColor) {
      ops.push(() => applyColorStrip(imagePath, brand.primaryColor!, brand.secondaryColor));
    }

    if (brand.logoBase64) {
      ops.push(() => overlayLogo(imagePath, brand.logoBase64!));
    } else if (brand.businessName && brand.primaryColor) {
      // Fallback: franja de color con nombre del negocio como texto SVG
      ops.push(() => overlayTextBadge(imagePath, brand.businessName!, brand.primaryColor!));
    }

    for (const op of ops) await op();

    logger.debug(`[Brand] Branding aplicado: ${path.basename(imagePath)}`);
  } catch (err) {
    logger.warn(`[Brand] No se pudo aplicar branding: ${(err as Error).message}`);
    // No re-throw — la imagen sin brand sigue siendo válida
  }
}

// ── Logo overlay ───────────────────────────────────────────────────────────

async function overlayLogo(imagePath: string, logoBase64: string): Promise<void> {
  const meta = await sharp(imagePath).metadata();
  const imgW  = meta.width  ?? 1080;
  const imgH  = meta.height ?? 1080;

  // Logo ocupa el 18% del ancho de la imagen
  const logoW = Math.round(imgW * 0.18);

  const logoBuffer = Buffer.from(logoBase64, 'base64');
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoW, undefined, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoH    = logoMeta.height ?? 80;

  const padding = Math.round(imgW * 0.03);
  const left    = imgW - logoW - padding;
  const top     = imgH - logoH - padding;

  // Leer base, aplicar composite, guardar en tmpfile, renombrar
  const tmpPath = imagePath + '.tmp.jpg';
  await sharp(imagePath)
    .composite([{ input: resizedLogo, top, left, blend: 'over' }])
    .jpeg({ quality: 92 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, imagePath);
}

// ── Color strip ────────────────────────────────────────────────────────────

async function applyColorStrip(
  imagePath:      string,
  primaryColor:   string,
  secondaryColor?: string,
): Promise<void> {
  const meta = await sharp(imagePath).metadata();
  const imgW  = meta.width  ?? 1080;
  const imgH  = meta.height ?? 1080;

  const stripH = Math.round(imgH * 0.07);
  const { r, g, b } = hexToRgb(primaryColor);

  // Franja sólida semitransparente en la parte inferior
  const strip = await sharp({
    create: { width: imgW, height: stripH, channels: 4, background: { r, g, b, alpha: 220 } },
  }).png().toBuffer();

  const tmpPath = imagePath + '.tmp.jpg';
  await sharp(imagePath)
    .composite([{ input: strip, top: imgH - stripH, left: 0, blend: 'over' }])
    .jpeg({ quality: 92 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, imagePath);
}

// ── Text badge fallback (cuando no hay logo) ───────────────────────────────

async function overlayTextBadge(
  imagePath:    string,
  businessName: string,
  primaryColor: string,
): Promise<void> {
  const meta = await sharp(imagePath).metadata();
  const imgW  = meta.width  ?? 1080;
  const imgH  = meta.height ?? 1080;

  const { r, g, b } = hexToRgb(primaryColor);
  const textColor = isLightColor(r, g, b) ? '#000000' : '#FFFFFF';
  const badgeH    = Math.round(imgH * 0.08);
  const fontSize  = Math.round(badgeH * 0.45);
  const padding   = Math.round(imgW * 0.03);

  // SVG badge con nombre del negocio
  const svgBadge = `
<svg width="${imgW}" height="${badgeH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${imgW}" height="${badgeH}" fill="rgb(${r},${g},${b})" fill-opacity="0.92"/>
  <text x="${padding}" y="${Math.round(badgeH * 0.7)}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}" font-weight="bold"
        fill="${textColor}">${escapeXml(businessName)}</text>
</svg>`;

  const badgeBuffer = Buffer.from(svgBadge);
  const tmpPath     = imagePath + '.tmp.jpg';

  await sharp(imagePath)
    .composite([{ input: badgeBuffer, top: imgH - badgeH, left: 0, blend: 'over' }])
    .jpeg({ quality: 92 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, imagePath);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function isLightColor(r: number, g: number, b: number): boolean {
  // Luminancia relativa — si > 0.5 el color es claro → usar texto oscuro
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
