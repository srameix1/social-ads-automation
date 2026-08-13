export type SniffableImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml';

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWithBytes(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

function isWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

// SVG es texto/XML, no tiene magic bytes binarios — se detecta por contenido.
// Recorta BOM UTF-8 y espacios en blanco iniciales, y acepta tanto <svg ...>
// directo como un prólogo <?xml ...?> seguido de <svg en los primeros bytes.
const SVG_CONTENT_PATTERN = /^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;
const SVG_SNIFF_WINDOW = 512;

function isSvg(buffer: Buffer): boolean {
  let text = buffer.subarray(0, SVG_SNIFF_WINDOW).toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  return SVG_CONTENT_PATTERN.test(text.trimStart());
}

/**
 * Detecta el tipo real de una imagen a partir de sus bytes, ignorando
 * cualquier Content-Type declarado por el cliente. Devuelve null si el
 * contenido no matchea ninguno de los formatos soportados.
 */
export function sniffImageType(buffer: Buffer): SniffableImageType | null {
  if (startsWithBytes(buffer, JPEG_MAGIC)) return 'image/jpeg';
  if (startsWithBytes(buffer, PNG_MAGIC))  return 'image/png';
  if (isWebp(buffer))                      return 'image/webp';
  if (isSvg(buffer))                       return 'image/svg+xml';
  return null;
}
