# Deploying to Vercel

Everything below is done in the Vercel dashboard. There are no commands to run
and nothing to install. It takes about 10 minutes.

| Step | What you do | Time |
|---|---|---|
| 1 | Connect this GitHub repository to your Vercel project | 2 min |
| 2 | Add a database (Neon) | 2 min |
| 3 | Add file storage (Vercel Blob) | 1 min |
| 4 | Add three environment variables | 2 min |
| 5 | Deploy | 3 min |
| 6 | Sign in to the admin panel | 1 min |

After this, every change pushed to the `main` branch deploys automatically.

> **Do not use Vercel Drop for this project.** Drop uploads files without
> building them. It will say "Ready", but every page returns `404: NOT_FOUND`.
> This app has to be built by Vercel from the GitHub repository.

---

## Step 1 — Connect the GitHub repository

Use your existing Vercel project, so you keep the same web address.

1. Open the project in the Vercel dashboard.
2. Click **Connect Git** on the project overview (or go to **Settings → Git**).
3. Choose **GitHub**, then select the **compasss** repository.
   - If it is not in the list, click **Adjust GitHub App Permissions** and give
     Vercel access to the repository, then come back and select it.

> Vercel may start a deployment as soon as the repository is connected. Until
> Steps 2–4 are done, it will fail with `These environment variables are not
> set`. That is expected — carry on with Step 2, and deploy in Step 5.
>
> Starting a new project instead? Use **Add New → Project** and import
> **compasss**, then continue with Step 2.

## Step 2 — Add a database

1. In the project, open **Storage** and click **Create Database**.
2. Choose **Neon** (Postgres) and click **Continue**.
3. Pick the region closest to your users and create the database.
4. When asked which environments to connect, keep **Production** and
   **Preview** selected.

Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the project for you.
You do not need to copy anything.

> Please choose **Neon**. Other providers name their settings differently, and
> the deployment will stop saying `DATABASE_URL` is not set.

You do **not** need to create any tables or load any data. That happens
automatically in Step 5.

## Step 3 — Add file storage

This stores candidate résumés and your logo and background images.

1. In **Storage**, click **Create Database** again and choose **Blob**.
2. Click **Continue** and set access to **Public**.
3. Give it any name (for example `uploads`) and create it.
4. Keep **Production** and **Preview** selected.

Vercel adds the storage token to the project for you.

> "Public" means a file can be opened by anyone who has its exact link. Every
> link contains a long random code, and links are only shown inside the admin
> panel.

## Step 4 — Add three environment variables

Go to **Settings → Environment Variables** and add these three. For each one,
keep **Production** and **Preview** selected.

| Name | Value |
|---|---|
| `AUTH_SECRET` | A long random string, at least 32 characters. Your password manager's generator works well. Keep it private. |
| `ADMIN_EMAIL` | The email address you want to sign in to the admin panel with. |
| `ADMIN_PASSWORD` | A strong password for that account. |

All three are required. The build checks for them and stops with a message
naming anything that is missing.

Environment variables live in **Vercel**, not in GitHub. Never add them to the
repository.

When you are done, the project should have these variables:

```
DATABASE_URL            (added by Neon in Step 2)
DATABASE_URL_UNPOOLED   (added by Neon in Step 2)
BLOB_READ_WRITE_TOKEN   (added by Blob in Step 3)
AUTH_SECRET             (added by you)
ADMIN_EMAIL             (added by you)
ADMIN_PASSWORD          (added by you)
```

## Step 5 — Deploy

1. Open **Deployments** and click **Create Deployment**.
2. Enter the branch `main` and click **Create Deployment**.

The build takes 2–4 minutes. During it, Vercel automatically:

- creates the database tables,
- loads the starter assessment content (first deployment only), and
- builds the app.

When the build finishes, the status shows **Ready**. To confirm it built
properly, open the deployment's **Build Logs** — near the end you should see a
route list that starts with:

```
┌ ƒ /
```

## Step 6 — Sign in to the master console

1. Go to `https://<your-domain>/master-admin`.
2. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from Step 4.

Your account is created as a **Super Admin** the first time you sign in. From
the admin panel you can add other admins under **Admins**, and change your
password under **Profile**.

The starter content includes:

- the **Cabin in the Woods: Survival Protocol** assessment, five scenarios,
- a second package, **Corporate Crisis**, with no scenarios in it yet, and
- one sample candidate, **Alex Mercer**, so the reports have something to
  show. You can delete this candidate from **Candidates** whenever you like.

Your own 50-scenario **Cabin in the Woods** pack is included separately and
can be imported from **Scenarios → Import**.

## Your site's pages

Opening your domain shows the **public side** for candidates, not the admin
panel.

| Address | Who it is for |
|---|---|
| `https://<your-domain>/` | The public homepage |
| `https://<your-domain>/practice` | Anyone who wants a practice run. No employer sees these |
| `https://<your-domain>/intake` | The open candidate form |
| `https://<your-domain>/assess?token=…` | An invited candidate. The link comes from an employer |
| `https://<your-domain>/portal` | Employers — their own candidates and nobody else's |
| `https://<your-domain>/master-admin` | You. Not linked from anywhere a candidate or employer looks |

The homepage links to the practice run and the employer sign-in, and to
nothing of yours. The master console opens from `/master-admin`, or by
clicking the copyright line in the footer five times, or with Ctrl+Shift+M.

That path is kept quiet for tidiness, not for safety: the console is
protected by its sign-in, and would be equally protected if the address were
printed on the homepage.

## If a push stops deploying

A private repository makes Vercel check who authored each commit. If the
deployment status reads:

> Git author &lt;name&gt; must have access to the project on Vercel to create
> deployments

then the commit's author name does not resolve to an account on the Vercel
project — and nothing deploys until it does. Confusingly the repository still
accepts the push; only the build is refused, so the last successful deployment
stays live and it looks like the new code did nothing.

Two things to check, in this order:

1. **The author name on the commit**, not the email. `git log -1 --format='%an
   <%ae>'`. It has to match the GitHub account that has access. A commit made
   with a different `user.name` — a GitHub username rather than the name on
   the account, say — is refused even when the email is right.
2. **Project access.** Vercel → Settings → Git, or add the account to the
   team.

A deploy hook does not get round this: it builds the branch it is bound to,
and that branch's HEAD commit is checked the same way.

## Giving previews their own database

Every push to a branch builds a preview. By default that preview talks to the
**production** database, because Vercel gives the Preview environment the same
`DATABASE_URL` unless you say otherwise. So the build refuses to migrate or
seed from a preview — testing a branch must not alter live data.

Point previews at their own database and they become fully testable, and you
can review a branch properly before it reaches production.

**1. Create the branch in Neon.** Neon console → your project → **Branches** →
**New branch**. Branch from `main` (or `production`), and name it something you
will recognise, e.g. `preview`. Neon copies the data as it stands, so the
preview starts with realistic content and nothing is shared with production
afterwards — writes on one do not touch the other.

**2. Copy its connection strings.** On the new branch, open **Connect** and
copy both the pooled and the direct (unpooled) connection strings.

**3. Point Vercel's Preview environment at it.** Vercel → project →
**Settings → Environment Variables**. For each of these, set the value and tick
**Preview only** — leave Production as it is:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the branch's pooled connection string |
| `DATABASE_URL_UNPOOLED` | the branch's direct connection string |
| `ALLOW_PREVIEW_DB_WRITES` | a distinctive part of the branch's host, e.g. `ep-quiet-moon-12345` |

That third one is the safety catch. It does not just say "yes" — it names the
database the preview is allowed to prepare. If `DATABASE_URL` is ever left
pointing at production, the value will not match and the build stops before
touching anything. Setting it to `1` also works but checks nothing, and the
build log will say so.

**4. Redeploy the branch.** The build log will say
`preview deployment - preparing its own database (…)` and name the host. Check
that the host is the branch, not production. If it says *leaving … untouched*,
one of the three variables is missing from the Preview scope.

Everything after that behaves normally on previews: migrations apply, the
retention purge runs, and starter content loads only if the branch is empty.

## After you deploy — three things to set

Nothing below breaks the site if you skip it, but the platform does less
until it is done.

**1. Choose which assessment runs where.** Master console → **Scenario
Packages**. Three separate slots: the public practice run, the default for new
employer accounts, and an override on any single account. Assigning one never
changes another, and a link already sent to a candidate keeps the assessment
it was issued with.

**2. Add an AI provider key.** Master console → **Settings** → provider panel.
Pick Anthropic, OpenAI, or any OpenAI-compatible endpoint, paste the key, type
the model id, and press **Test connection** — that makes one cheap call and
tells you straight away if the key or model id is wrong. Without a key, the
assessment and reports work normally; only the written evaluation is missing.

**3. Verify your sending domain.** Until DNS records for
`continentalworks.com` are in place, no email is sent — invitations and
report-ready notices are written and held, viewable under **Settings →
Outbound Email**. Mail from an unverified domain is filtered as spam, which is
worse than not sending it. Meanwhile employers copy the invitation link from
the portal, and see an in-app notification when a report is ready.

## Uploading your own assessment

Master console → **Scenarios** → **Import**. Drop in a `.json` or `.csv` and
the uploader tells you what it found — how many scenarios and options, the
weight scale, which dimensions already exist and which would be created, and
any row it could not read — before anything is saved.

The format, with a downloadable template for each, is in
[docs/scenario-pack-format.md](docs/scenario-pack-format.md).

One thing worth knowing when you author a pack: a dimension is only as
reliable as the number of scenarios that can move it. If a dimension is scored
in just one scenario, a candidate's result on it is a single choice — they
score 0 or 100 and nothing between. Reports show that count and leave thinly
covered dimensions out of the headline figure, so it is visible rather than
misleading.

---

## How automatic deployments work

- **Every push to `main`** creates a new production deployment automatically.
  Nothing else to do.
- **Pushes to any other branch** create a preview deployment with its own
  temporary link, without touching the live site.
- **Your data is never overwritten.** The starter content only loads into an
  empty database. Database structure updates are applied automatically; if an
  update would ever delete data, the deployment stops instead of going ahead.
- **Changing an environment variable** does not update the live site on its
  own. After changing one, go to **Deployments**, open the **⋯** menu on the
  latest deployment and click **Redeploy**.

## Private repository and the Hobby plan

This repository is currently **public**. If you make it private and your
Vercel account is on the free **Hobby** plan, Vercel will only deploy commits
made by the account owner. Changes pushed by your developer would then show as
blocked ("commit author does not have contributing access").

To keep automatic deployments working with a private repository, upgrade to
the **Pro** plan and add your developer as a team member.

---

## Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| `404: NOT_FOUND` on every page, and the deployment has no build log | It was deployed with Vercel Drop | Follow Step 1, then Step 5 |
| Build fails with `These environment variables are not set` | A required setting is missing — the message lists which | Add what it lists (Step 2 or Step 4), then redeploy |
| Build fails with `No admin account exists yet` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` are missing | Add both (Step 4), then redeploy |
| Build fails with `Failed to collect page data`, with `AUTH_SECRET must be set in production` just above it | `AUTH_SECRET` is missing | Add it (Step 4), then redeploy |
| Build fails with `Can't reach database server` | The database is unreachable | Check the database in **Storage**, then redeploy |
| `Invalid credentials` on your first sign-in | `ADMIN_EMAIL` / `ADMIN_PASSWORD` don't match, or were added after the last deploy | Check both values, then redeploy |
| Résumé, logo or background upload fails | File storage is not connected | Follow Step 3, then redeploy |
| Uploading a large file fails | Vercel limits uploads to about 4.5 MB | Use a file under 4.5 MB |
| Candidates see `No active assessment package configured` | No package is active | In the admin panel, open **Packages** and activate one |
| Errors mentioning `prepared statement` | Connection pooling setting | In **Settings → Environment Variables**, add `?pgbouncer=true` to the end of `DATABASE_URL` (or `&pgbouncer=true` if it already contains a `?`), then redeploy |
| Deployment blocked: `commit author does not have contributing access` | Private repository on the Hobby plan | See [Private repository and the Hobby plan](#private-repository-and-the-hobby-plan) |
