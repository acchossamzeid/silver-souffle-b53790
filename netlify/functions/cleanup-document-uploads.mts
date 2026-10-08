import { lt, eq } from 'drizzle-orm';
import { getDatabase } from '../../db/index.js';
import { documentUploads } from '../../db/schema.js';
import { removeUploadParts } from '../../server/document-storage.js';

export default async () => {
  const db = getDatabase();
  const expired = await db.select().from(documentUploads)
    .where(lt(documentUploads.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))).limit(100);
  for (const upload of expired) {
    await removeUploadParts(upload.id, upload.size);
    await db.delete(documentUploads).where(eq(documentUploads.id, upload.id));
  }
  return new Response(null, { status: 204 });
};

export const config = { schedule: '0 * * * *' };
