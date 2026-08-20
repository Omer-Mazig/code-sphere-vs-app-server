# code-sphere-server

Backend API service for CodeSphere.

For full setup, development workflow, API typing flow, and troubleshooting:

- see the monorepo guide at `../README.md`

## Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Required secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.

## Quick commands

```bash
npm install
npm run start:dev
npm run build
```

## Database schema

`synchronize` is enabled only when `NODE_ENV` is not `production`. Production must use migrations.

```bash
# Create a new migration from entity changes
npm run migration:generate -- src/database/migrations/DescriptiveName

# Apply pending migrations
npm run migration:run

# Undo the last migration
npm run migration:revert
```

Existing local databases created with `synchronize` already have the schema. Baseline them by recording the initial migration as applied (without executing it), or start from a fresh database and run `migration:run`.

Swagger (`/docs`) is mounted only outside production.

## Email verification

Registration does not sign the user in. A verification link is emailed (or printed to the terminal when `EMAIL_PROVIDER=console`).

- Dev: leave `EMAIL_PROVIDER=console`. The API also returns `verificationUrl` so the UI can open the link.
- Prod: set `EMAIL_PROVIDER=smtp` plus `SMTP_HOST` / `SMTP_FROM` (and auth if required).

Existing local users created before this change should be marked verified (`emailVerified = true`) or re-seeded. Seed users are created as verified.
