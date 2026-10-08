import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const customerDocuments = pgTable('customer_documents', {
  customerId: text('customer_id').primaryKey(),
  blobKey: text('blob_key').notNull(),
  filename: text('filename').notNull(),
  size: integer('size').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const documentUploads = pgTable('customer_document_uploads', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  filename: text('filename').notNull(),
  size: integer('size').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('customer_document_uploads_created_at_idx').on(table.createdAt)]);
