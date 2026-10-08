export const MAX_PDF_SIZE = 5 * 1024 * 1024;
export const UPLOAD_CHUNK_SIZE = 1024 * 1024;

export function validPdfMetadata(filename: unknown, size: unknown): boolean {
  return typeof filename === 'string' && filename.length <= 255 &&
    !/[\u0000-\u001f\u007f/\\]/.test(filename) && /\.pdf$/i.test(filename) &&
    typeof size === 'number' && Number.isSafeInteger(size) && size > 0 && size <= MAX_PDF_SIZE;
}

export function validPdfContent(bytes: Uint8Array): boolean {
  if (!bytes.length || bytes.length > MAX_PDF_SIZE) return false;
  const header = new TextDecoder().decode(bytes.subarray(0, 8));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  return /^%PDF-\d\.\d/.test(header) && /%%EOF[\s\u0000]*$/.test(tail);
}
