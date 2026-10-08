import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDatabase } from '../../db/index.js';
import { customerDocuments, documentUploads } from '../../db/schema.js';
import { authorizeCustomer, DocumentError } from '../../server/document-auth.js';
import { documentStore, partKey, removeUploadParts } from '../../server/document-storage.js';
import { UPLOAD_CHUNK_SIZE, validPdfContent, validPdfMetadata } from '../../server/document-validation.js';

export default async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    if (!['GET', 'POST', 'PUT'].includes(request.method)) {
      return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET, POST, PUT' } });
    }
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer');
    if (!customerId || !/^[1-9]\d{0,15}$/.test(customerId)) throw new DocumentError(400, 'invalid_customer');
    const userId = await authorizeCustomer(request, customerId);
    const db = getDatabase();
    const store = documentStore();
    if (request.method === 'GET') {
      const [document] = await db.select().from(customerDocuments).where(eq(customerDocuments.customerId, customerId));
      if (!document) throw new DocumentError(404, 'no_document');
      if (!url.searchParams.has('download')) {
        return Response.json({ filename: document.filename, size: document.size }, { headers });
      }
      const content = await store.get(document.blobKey, { type: 'stream' });
      if (!content) throw new DocumentError(404, 'no_document');
      return new Response(content, { headers: {
        ...headers, 'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="customer-document.pdf"; filename*=UTF-8''${encodeURIComponent(document.filename).replace(/'/g, '%27')}`,
        'Content-Length': String(document.size),
      } });
    }
    if (request.method === 'POST' && !url.searchParams.has('upload')) {
      const metadata = await request.json() as { filename: unknown; size: unknown };
      if (!validPdfMetadata(metadata.filename, metadata.size)) throw new DocumentError(400, 'invalid_pdf');
      const uploadId = randomUUID();
      await db.insert(documentUploads).values({
        id: uploadId, customerId, uploadedBy: userId, filename: metadata.filename as string, size: metadata.size as number,
      });
      return Response.json({ uploadId }, { status: 201, headers });
    }
    const uploadId = url.searchParams.get('upload');
    if (!uploadId || !/^[0-9a-f-]{36}$/.test(uploadId)) throw new DocumentError(400, 'invalid_upload');
    const [upload] = await db.select().from(documentUploads).where(and(
      eq(documentUploads.id, uploadId), eq(documentUploads.customerId, customerId), eq(documentUploads.uploadedBy, userId),
    ));
    if (!upload || Date.now() - upload.createdAt.getTime() > 60 * 60 * 1000) throw new DocumentError(404, 'invalid_upload');
    const partCount = Math.ceil(upload.size / UPLOAD_CHUNK_SIZE);
    if (request.method === 'PUT') {
      const partValue = url.searchParams.get('part');
      const part = partValue === null ? NaN : Number(partValue);
      if (!Number.isInteger(part) || part < 0 || part >= partCount) throw new DocumentError(400, 'invalid_upload');
      const expectedSize = Math.min(UPLOAD_CHUNK_SIZE, upload.size - part * UPLOAD_CHUNK_SIZE);
      const contentLength = Number(request.headers.get('content-length'));
      if (contentLength > UPLOAD_CHUNK_SIZE) throw new DocumentError(413, 'invalid_pdf');
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength !== expectedSize) throw new DocumentError(400, 'invalid_upload');
      await store.set(partKey(uploadId, part), bytes);
      return Response.json({ saved: true }, { headers });
    }
    const bytes = new Uint8Array(upload.size);
    for (let part = 0; part < partCount; part++) {
      const chunk = await store.get(partKey(uploadId, part), { type: 'arrayBuffer' });
      if (!chunk || chunk.byteLength !== Math.min(UPLOAD_CHUNK_SIZE, upload.size - part * UPLOAD_CHUNK_SIZE)) {
        throw new DocumentError(400, 'incomplete_upload');
      }
      bytes.set(new Uint8Array(chunk), part * UPLOAD_CHUNK_SIZE);
    }
    if (!validPdfContent(bytes)) throw new DocumentError(400, 'invalid_pdf');
    const blobKey = `documents/${customerId}/${uploadId}.pdf`;
    await store.set(blobKey, bytes.buffer);
    let oldBlobKey: string | undefined;
    try {
      await db.transaction(async transaction => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${customerId}))`);
        const [old] = await transaction.select().from(customerDocuments).where(eq(customerDocuments.customerId, customerId)).for('update');
        oldBlobKey = old?.blobKey;
        const document = { customerId, blobKey, filename: upload.filename, size: upload.size, uploadedBy: userId, updatedAt: new Date() };
        await transaction.insert(customerDocuments).values(document).onConflictDoUpdate({ target: customerDocuments.customerId, set: document });
        await transaction.delete(documentUploads).where(eq(documentUploads.id, uploadId));
      });
    } catch (error) {
      await store.delete(blobKey).catch(() => {});
      throw error;
    }
    await removeUploadParts(uploadId, upload.size).catch(() => {});
    if (oldBlobKey && oldBlobKey !== blobKey) await store.delete(oldBlobKey).catch(() => {});
    return Response.json({ filename: upload.filename, size: upload.size }, { headers });
  } catch (error) {
    const known = error instanceof DocumentError;
    const status = known ? error.status : error instanceof SyntaxError ? 400 : 503;
    return Response.json({ error: known ? error.code : status === 400 ? 'invalid_upload' : 'unavailable' }, { status, headers });
  }
};
