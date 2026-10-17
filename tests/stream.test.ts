import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUIMessageStreamResponse } from 'ai';
import { createStaticAssistantStream } from '../lib/chat/stream';

test('assistant stream preserves SSE framing, content and completion', async () => {
  const response = createUIMessageStreamResponse({
    stream: createStaticAssistantStream('offline hello'),
  });
  assert.match(
    response.headers.get('content-type') ?? '',
    /text\/event-stream/,
  );
  const body = await response.text();
  assert.match(body, /"type":"start"/);
  assert.match(body, /"delta":"offline hello"/);
  assert.match(body, /"type":"finish"/);
  assert.match(body, /\[DONE\]/);
});
test('empty assistant responses still terminate correctly', async () => {
  const response = createUIMessageStreamResponse({
    stream: createStaticAssistantStream(''),
  });
  const body = await response.text();
  assert.doesNotMatch(body, /"type":"text-delta"/);
  assert.match(body, /\[DONE\]/);
});
