# Next.js 16 and stable Workflow migration

Prepared against `ed1761f914526e60a96caa7c0c773dadf34bb780` on 2026-10-17.

## Changes

- App and standalone `.docs` app: Next.js 16.4.2, React/React DOM 19.3.1, React types 19.3.0.
- Workflow 5.2.2 and `@workflow/ai` 5.0.3 replace the mismatched beta stack. AI SDK stays on major 6, as required by the stable Workflow AI peer dependency.
- Enable Next.js Webpack build workers and memory optimizations to avoid excessive compiler heap usage in constrained CI.
- Keep explicit Webpack for the application to avoid introducing a second bundler migration. Workflow 5 supports both bundlers; the documentation app uses the Next.js 16 default Turbopack.
- Rename middleware to `proxy.ts`; retain route/authentication semantics and Workflow callback exclusions.
- Match nullable React 19 refs and generated Next.js TypeScript settings; remove the unsupported `experimental_ppr` route export (the previous config did not enable PPR globally).
- Invalid Base64 authentication cookies now return an unauthenticated result rather than an uncaught exception.
- Add read-only lint/typecheck and offline test commands. Ignore generated `next-env.d.ts` in Biome because Next.js rewrites its quote style.

## Runtime and verification

Use Node >=20.9 and Bun 1.3.11. Run `bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`, `bun test tests`, then `bun run build`. The standalone docs app has its own install/lockfile and must also be built.

Offline tests cover signed/tampered/malformed/expired sessions, API rejection and page redirects, public/Workflow route exemptions, static SSE completion and reconnect responses using mocked storage/Workflow dependencies. These are not live provider or durable replay integration tests.

Do not pull production environment variables for verification. Database, Redis, Blob, Sandbox and paid model calls require separate sandbox integration testing. The existing production Vercel postbuild runs database changes; publishing or deployment must be separately approved. No deployment is part of this patch.

## Security and upgrade references

- https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj
- https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://workflow-sdk.dev/docs/getting-started/next

Next.js 16.4.2 is newer than the patched versions for both cited Server Action denial-of-service advisories. The October advisory requires at least 15.5.28 or 16.4.1; the older July patch alone is insufficient. Exact latest stable versions and Workflow AI peers were checked against the npm registry on the preparation date.

## Verification performed

- Frozen Bun lockfile installation: passed.
- Main `bun run typecheck`: passed, including generated route types.
- Main `bun run lint`: passed (227 files).
- `bun test tests`: 11 passed, 0 failed.
- Standalone docs TypeScript and production Turbopack static export: passed (11 pages).
- Main production Webpack build: passed (28 static pages, dynamic app/API/Workflow routes). Used 1024MB Node heap, build worker/memory optimizations, loopback-only dummy DATABASE_URL, REDIS_URL, KV_REST_API_URL and placeholder KV token. Invoked Next directly to avoid production postbuild/database operations.
- Built production server HTTP smoke checks: six passed (login HTML, protected-page redirect, anonymous API rejection, bad credentials, successful login with HttpOnly cookie and external-redirect rejection, malformed-cookie rejection). Server was stopped afterward.
- Patch whitespace and reverse-application checks: passed.

Initial unconstrained compiler builds were killed by the runner, and a 768MB heap trial exhausted V8 heap. Enabling the documented build worker/memory optimizations resolved compilation within a 1024MB heap. The first successful compilation required adding a dummy REDIS_URL for import-time Chat SDK configuration, then the complete build passed.

Not exercised: live database/Redis/blob access, real LLM calls, IM webhooks, actual durable workflow replay/recovery or deployment. Reconnect unit tests mock the Workflow/storage boundary; staging integration checks remain necessary before production release.
