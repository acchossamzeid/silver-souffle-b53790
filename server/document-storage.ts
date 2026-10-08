import { getStore } from '@netlify/blobs';
import { UPLOAD_CHUNK_SIZE } from './document-validation.js';

export function documentStore() {
  return getStore({ name: 'customer-documents', consistency: 'strong' });
}

export function partKey(uploadId: string, part: number) {
  return `uploads/${uploadId}/${part}`;
}

export async function removeUploadParts(uploadId: string, size: number) {
  const store = documentStore();
  await Promise.all(Array.from({ length: Math.ceil(size / UPLOAD_CHUNK_SIZE) },
    (_, part) => store.delete(partKey(uploadId, part))));
}
