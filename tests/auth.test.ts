import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '../lib/auth/constants';
import { createAuthToken, verifyAuthToken } from '../lib/auth/session';
import { config, proxy } from '../proxy';

const original = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  USERNAME: process.env.USERNAME,
  PASSWORD: process.env.PASSWORD,
};
before(() => {
  process.env.AUTH_SECRET = 'offline-test-secret-not-for-production';
  process.env.USERNAME = 'offline-test';
  process.env.PASSWORD = 'offline-test-password';
});
after(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test('signed sessions round-trip and tampered or malformed cookies fail closed', async () => {
  const token = await createAuthToken('offline-test');
  assert.equal((await verifyAuthToken(token))?.username, 'offline-test');
  for (const invalid of [
    undefined,
    '',
    'junk',
    'a.!!!',
    `${token}.extra`,
    `${token}x`,
  ]) {
    assert.equal(await verifyAuthToken(invalid), null);
  }
});
test('unauthenticated pages redirect and APIs reject access', async () => {
  const page = await proxy(new NextRequest('http://localhost/chat?test=1'));
  assert.equal(page.status, 307);
  assert.equal(
    new URL(page.headers.get('location') ?? '').searchParams.get('redirectTo'),
    '/chat?test=1',
  );
  const api = await proxy(new NextRequest('http://localhost/api/ai'));
  assert.equal(api.status, 401);
});
test('login, assets and workflow callbacks retain exemptions', async () => {
  for (const path of [
    '/login',
    '/api/auth/login',
    '/icon.png',
    '/.well-known/workflow/v1/step',
  ]) {
    const response = await proxy(new NextRequest(`http://localhost${path}`));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});
test('valid sessions pass and malformed signatures return 401', async () => {
  const token = await createAuthToken('offline-test');
  for (const [cookie, status] of [
    [token, 200],
    ['payload.!!!', 401],
  ] as const) {
    const response = await proxy(
      new NextRequest('http://localhost/api/ai', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cookie}` },
      }),
    );
    assert.equal(response.status, status);
  }
});

test('expired sessions fail closed', async () => {
  const originalNow = Date.now;
  let token: string;
  try {
    Date.now = () => 0;
    token = await createAuthToken('offline-test');
  } finally {
    Date.now = originalNow;
  }
  assert.equal(await verifyAuthToken(token), null);
});

test('missing auth configuration fails closed without calling services', async () => {
  const secret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = '';
  try {
    const response = await proxy(new NextRequest('http://localhost/api/ai'));
    assert.equal(response.status, 503);
  } finally {
    process.env.AUTH_SECRET = secret;
  }
});

test('matcher excludes Workflow callbacks and framework assets', () => {
  for (const url of [
    '/.well-known/workflow/v1/flow',
    '/.well-known/workflow/v1/step',
    '/_next/static/chunk.js',
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }),
      false,
    );
  }
  assert.equal(
    unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/api/ai' }),
    true,
  );
});
