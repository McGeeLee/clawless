export const SESSION_LIST_INVALIDATED_EVENT = 'clawless:sessions:invalidated';
export const SESSION_LIST_UPSERTED_EVENT = 'clawless:sessions:upserted';

export type SessionListItemEventDetail = {
  id: string;
  title: string | null;
  channel: string;
  createdAt: string;
};

export function invalidateSessionList(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(SESSION_LIST_INVALIDATED_EVENT));
}

export function upsertSessionListItem(
  detail: SessionListItemEventDetail,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<SessionListItemEventDetail>(SESSION_LIST_UPSERTED_EVENT, {
      detail,
    }),
  );
}
