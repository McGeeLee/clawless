import { expect, mock, test } from 'bun:test';

let session = { id: 'offline-session' };
let status = 'running';
mock.module('@/lib/core/db/chat', () => ({
  getSessionByWorkflowRunId: async () => session,
}));
mock.module('@/lib/workflow/agent/dispatch', () => ({
  getWorkflowStatus: async () => status,
  getWorkflowRun: () => ({
    readable: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'offline-message' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    }),
  }),
}));
const { GET } = await import('../app/(chat)/api/ai/[runId]/stream/route');
const request = new Request('http://localhost/api/ai/offline-run/stream');
const context = { params: Promise.resolve({ runId: 'offline-run' }) };

test('reconnect streams an active run with session and workflow identifiers', async () => {
  const response = await GET(request, context);
  expect(response.status).toBe(200);
  expect(response.headers.get('x-session-id')).toBe('offline-session');
  expect(response.headers.get('x-workflow-run-id')).toBe('offline-run');
  expect(await response.text()).toContain('[DONE]');
});
test('completed and missing runs return no stream', async () => {
  status = 'completed';
  expect((await GET(request, context)).status).toBe(204);
  session = null;
  expect((await GET(request, context)).status).toBe(204);
});
