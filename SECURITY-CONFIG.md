# Runtime credentials

Copy `.env.example` to `.env` and populate it outside Git. Keep the existing deployment credentials during migration; this change does not rotate or revoke anything. Never commit populated environment files or put secrets in VITE_* variables.

Docker Compose reads the root `.env`. DATABASE_URL must use the Docker service hostname `db` and the database's container port (Sarabun: DB_PORT; Dynamic Report: 5432). For local development, use localhost and the published database port. URL-encode username/password components in DATABASE_URL. Changing POSTGRES_* does not update an existing PostgreSQL volume: retain the existing values. Do not delete volumes.

Dynamic Report local development reads `server/.env`; use `server/.env.example` as its template. Optional SEED_*_PASSWORD variables apply only to newly created sample users. When absent, new sample users receive unpredictable random passwords. Existing user records are not updated. Database initialization no longer ships fixed sample passwords.

Docker build contexts exclude local environment and private key files. Supply secrets at runtime, never as build arguments.

## Sarabun SDC integration

Set JWT_SECRET to the existing issuer's signing secret, SDC_API_BASE_URL to the service URL, and SDC_API_AUTHORIZATION to the complete authorization header supplied by that service. These remain on the backend. Opening a signed document URL stores the document token for this browser tab, then redirects to the same clean document URL as before. Only a valid signed token for that document authorizes SDC reads/uploads. Invalid/expired tokens and direct ID links without a valid tab token are rejected. Reopen a signed document link to renew access. The former decode-only fallback is deliberately removed because it cannot protect a server-held SDC credential. Supported shared-secret algorithms: HS256, HS384, HS512; verify the actual issuer configuration before deployment.

The local PDF editing flow and VITE_SDC_DRY_RUN remain available. SDC calls require runtime configuration; no production service was contacted during cleanup.

## Previously exposed values

History cleanup cannot invalidate credentials or remove copies in existing clones, browser bundles, caches, container registries, forks, or GitHub's retained objects. Coordinate rotation/revocation with the owner separately. Rebuild frontend/backend images after configuration review; do not reuse an old frontend bundle that embedded credentials. Collaborators must reclone after rewritten history and must not merge old branches back.
