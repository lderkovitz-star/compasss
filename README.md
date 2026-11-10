# Compass — Executive Assessment Platform

A multi-tenant decision assessment platform. Employers invite candidates,
candidates work through scenarios under time pressure with no feedback, and
each sitting produces a dimension profile and a written evaluation.

Built with Next.js 14 (App Router), Prisma and PostgreSQL.

## Who sees what

| Address | Who it is for |
|---|---|
| `/` | Public homepage |
| `/practice` | Anyone. Belongs to no employer and is deleted after 30 days |
| `/intake` | The open candidate form |
| `/assess?token=…` | An invited candidate. No name or email form - the invite carries it |
| `/portal` | An employer. Their own candidates and nobody else's |
| `/master-admin` | Whoever runs the platform |

Every employer-facing query is scoped by `clientAccountId`. Practice runs
carry no tenant, so the same filter excludes them without anyone having to
remember to. The one deliberate cross-tenant read is the Live talent registry,
which is master-admin only and audited on every access.

## Deploying

**See [DEPLOY.md](DEPLOY.md)** for step-by-step instructions, including the
three things to configure once it is up.

Do not deploy this project with Vercel Drop — it must be built by Vercel from
this repository.

## Environment variables

All are set in Vercel under **Settings → Environment Variables**. See
[`.env.example`](.env.example) for details.

| Name | Set by |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Vercel, when you connect a Neon database |
| `BLOB_READ_WRITE_TOKEN` | Vercel, when you connect a Blob store |
| `AUTH_SECRET` | You. Also derives the key that encrypts stored provider keys, so changing it means re-entering those |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | You — the first sign-in with these creates the Super Admin account |

## Local development

Requires Node.js 18.17+ and a PostgreSQL database.

```bash
cp .env.example .env   # then fill in the values
npm install
npm run db:migrate     # apply migrations
npm run db:seed        # load starter content - clears existing content first
npm run dev
```

Open http://localhost:3000.

## The database

Schema changes go through migrations, not `prisma db push` — `db:push` is still
in package.json for throwaway local work, but using it against a database that
has migration history will drift from it silently.

```bash
npm run db:migrate            # apply pending migrations
npm run db:backfill           # assign pre-tenancy rows to the legacy tenant
npm run db:rank-registries    # recompute talent registry percentiles
npm run db:purge-expired      # delete practice runs past their retention date
```

`prepare-db.ts` runs the migration, the backfill and the purge in that order on
every deploy, so a regularly deployed instance needs no scheduler. The purge
keeps any practice run that joined the talent registry - the person asked for
it to be kept, and the registry entry cascades from the sitting.

`20261013084247_tenant_scoped_candidates` is the one migration that can fail
on existing data rather than only adding to it. It checks its own assumptions
first and names the one that failed, and the backfill above has to run before
it. `prisma/prepare-db.ts` does both in the right order during a Vercel build.

## Authoring assessments

The scenario pack format, with templates, is in
[docs/scenario-pack-format.md](docs/scenario-pack-format.md). Packs are
uploaded from the master console and previewed before anything is written.

Scores are normalised per dimension against the range that dimension could
actually reach in the scenarios a candidate answered — so packs of different
lengths and different weight scales are both usable, and comparable.
