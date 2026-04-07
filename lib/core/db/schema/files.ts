import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sessions } from './chat';

export const files = pgTable(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    runId: text('run_id'),
    sandboxId: text('sandbox_id'),
    sourcePath: text('source_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    blobPath: text('blob_path').notNull(),
    blobUrl: text('blob_url').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    filesSessionCreatedAtIdx: index('files_session_created_at_idx').on(
      table.sessionId,
      table.createdAt,
    ),
    filesCreatedAtIdx: index('files_created_at_idx').on(table.createdAt),
    filesRunCreatedAtIdx: index('files_run_created_at_idx').on(
      table.runId,
      table.createdAt,
    ),
  }),
);
