# CognitiveEdge — Executive Assessment Platform

Scenario-based cognitive and behavioral assessment platform for executive
candidates, with an admin panel for packages, scenarios, candidates and
reports.

Built with Next.js 14 (App Router), Prisma and PostgreSQL.

## Deploying

**See [DEPLOY.md](DEPLOY.md)** for step-by-step instructions. Deployment is
done entirely from the Vercel dashboard and takes about 10 minutes.

Do not deploy this project with Vercel Drop — it must be built by Vercel from
this repository.

## Environment variables

All are set in Vercel under **Settings → Environment Variables**. See
[`.env.example`](.env.example) for details.

| Name | Set by |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Vercel, when you connect a Neon database |
| `BLOB_READ_WRITE_TOKEN` | Vercel, when you connect a Blob store |
| `AUTH_SECRET` | You |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | You — the first sign-in with these creates the Super Admin account |

## Local development

Requires Node.js 18.17+ and a PostgreSQL database.

```bash
cp .env.example .env   # then fill in the values
npm install
npm run db:push        # create the tables
npm run db:seed        # load starter content - clears existing content first
npm run dev
```

Open http://localhost:3000.
