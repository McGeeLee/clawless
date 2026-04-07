import { Chat } from '@/components/chat';
import { generateUUID } from '@/lib/utils';

/**
 * New conversation entry page.
 *
 * **Lazy session creation flow:**
 * 1. During SSR, generate a random UUID as chatId (sessionId).
 * 2. No DB session row exists yet; this is only a placeholder ID.
 * 3. When the user sends the first message, the frontend posts it with this chatId to POST /api/ai.
 * 4. Before persisting the first message, chat layer checks the DB and creates a new session row with this UUID if missing.
 *
 * Benefit: avoids piling up empty sessions, while allowing early navigation to /chat/{id}.
 */
export default async function Page() {
  const id = generateUUID();

  return (
    <>
      <Chat key={id} id={id} />
    </>
  );
}
