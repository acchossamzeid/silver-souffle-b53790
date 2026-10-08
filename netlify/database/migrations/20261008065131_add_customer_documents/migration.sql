CREATE TABLE "customer_documents" (
	"customer_id" text PRIMARY KEY,
	"blob_key" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_document_uploads" (
	"id" text PRIMARY KEY,
	"customer_id" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "customer_document_uploads_created_at_idx" ON "customer_document_uploads" ("created_at");