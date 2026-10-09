# Partheanon

**Your commitments, in perspective.**

Partheanon is a personal command center created by Rob Brown (Forge), with Aegis as the intended planning partner. Its purpose is to bring commitments scattered across work, volunteer, business, and personal communication into one rolling view—and make room to deliver on them.

A commitment connects **a stakeholder, a task, a deadline, a time estimate, and an expected output**. The larger vision is for Aegis to identify conflicts and overcommitment, help prioritize work, and protect the time needed to finish it.

This repository preserves the idea and the working source, including the dark green, sage, and teal interface and the additional connection setup flow. It is a source archive; the live dashboard remains private.

## Current experience

- **Overview and schedule:** a rolling 14-day calendar horizon, busy-event conflicts, work capacity, and deadline risk checks in America/Phoenix time.
- **Adapted Eisenhower priorities:** life/health/safety first, security/privacy second. Importance is explicit and urgency follows deadlines/capacity. Confirmed prerequisites unlock downstream work and inherit its protection group. Blocked protected work is surfaced; prerequisite cycles (including parent completion constraints) and completion before prerequisites are rejected. Your chosen task comes first within protection groups. Unknown importance remains unassessed.
- **Focus order:** a changing, explained sequence combining user-recorded delay consequences and people held up, deadline pressure, calendar capacity, protected blocks, progress, and parent deadlines. Waiting tasks and zero-estimate containers remain separate. Choose next persists across devices. Review with Aegis opens a prepared prompt; send it for contextual advice. Missing calendar coverage is labeled, and unknown stakes are not inferred.
- **Commitments:** tasks with a project, lane, stakeholder, deadline, remaining work estimate, status, output, and source link.
- **Parent–child commitments:** nested subtasks with their own deadlines and remaining estimates. Parent completion requires all subtasks to be complete; cycles and cross-user parents are rejected. Estimates cover each task’s own work.
- **Work performed / output:** separate dated notes per commitment, with up to 20,000 characters, bullet lists, bold text, headings, code, and a preview. Notes can be edited or removed and are included in backups. They do not add work time or mark subtasks complete. Timed work entries also accept 20,000-character notes.
- **Actual work logs:** dated elapsed minutes, AI-assisted minutes included within elapsed time, skills used, and work performed. The edit page shows own time and totals including descendants. Entries are saved separately from task edits and can be removed. Logged time does not automatically reduce the remaining estimate.
- **Projects:** commitments grouped by project and progress.
- **Protected work time:** proposed and saved internal focus blocks, with calendar conflict checks and a 15-minute buffer.
- **Inbox review:** recent Gmail and Outlook inbox candidates with rule-based importance signals; review is required before turning them into commitments. Remove a message from review without deleting it from Gmail or Outlook; per-user removals persist across refreshes and devices. Undo the latest removal or restore recent messages from the Removed view. Linked commitments remain intact.
- **Committed source items:** meeting actions, Notion pages, and emails show Committed after a task is saved; clicking opens the existing task. Completed source items are struck through and show Completed; reopening restores their appearance. Source associations persist through edits and completion. Older tasks are recognized when their source link and original title or output still match.
- **Meeting notes:** an index of accessible Notion pages, meeting summaries, and unchecked action items, with coverage and freshness information.
- **Connections:** save an additional Google or Microsoft account, choose its lane and services, open the secure access flow, and verify the actual account identity before reading data. Shortcuts include the accounts supplied during the original project setup.
- **Responsive dark interface:** desktop, iPhone, and iPad layouts with soft green and teal accents and slightly larger text.
- **Calendar export:** an `.ics` snapshot of task deadlines and protected work blocks.

## Settings

Settings includes Dark (default), Light, and device theme preferences saved to the user’s account, work hours, connection management, manual source refresh, a JSON export of commitments and setup records, sign-out, and About. Theme colors cover the whole interface, including forms and dialogs. External authentication and provider pages keep their own appearance. Account management opens ChatGPT in another tab with Settings → Plugins (or Apps) instructions; Site reconnection is offered separately when a read reports reauthentication required.

## What is implemented—and what remains

Source reads refresh every five minutes while the dashboard is open. Failed reads retain the previous snapshot and display its last-read time. Background and instant synchronization are future work.

The current Google Site consent screen selects one Gmail account and one Google Calendar account per visitor. Connecting multiple Google accounts in ChatGPT does not grant simultaneous reads from all of them. A different returned identity is reported as **Different account selected**, independently of authorization errors. The setup dialog offers **Review Site account selection**; switching stops live reads for the previous selection. Microsoft connectors may also expose one selected account per service. Saving an account does not authorize it. Verification checks the provider-reported email before loading that account's data; switching the selected account can interrupt reads for a previous account.

Calendar reads cover a bounded 14-day window. Google reads the primary and Family calendars; Outlook reads the default and supported iCloud calendars, with pagination limits. A capacity estimate is only as complete as the sources it can see.

Notion coverage includes recent, private, shared, and favorite page listings and batched page reads. It is not a complete recursive database scan. Teamspaces are not separate workspaces. Additional workspace names remain setup requests until actual coverage can be reviewed; the connector does not provide separate workspace identity verification.

Direct Apple / iCloud account synchronization is unavailable. An Apple account can be saved as a request; an iCloud calendar already subscribed through Outlook is a separate path.

Protected blocks are stored in Partheanon. Exporting a calendar is a snapshot, not a live subscription or an external calendar update. The app does not automatically send messages or write to email, Notion, or external calendars.

Aegis integration is exposed through Site MCP tools for reading commitments, analyzing workload, saving commitments with parent relationships, logging actual work with AI assistance and skills, and protecting work blocks. Direct use requires the Site plugin and workspace permissions; availability depends on the deployment workspace's permissions. The dashboard's capacity checks are deterministic rules, with no embedded model API call or API key.

## Architecture

| Area | Implementation |
| --- | --- |
| Interface | React 19, TypeScript, Vinext/Vite, Lucide icons, custom CSS |
| Hosting | ChatGPT Sites on Cloudflare Workers |
| Identity | ChatGPT sign-in and visitor connected-app consent |
| Storage | Cloudflare D1, Drizzle ORM, versioned SQL migrations |
| Sources | Google Calendar, Gmail, Outlook Calendar, Outlook Email, Notion |
| Planning | Interval merging, capacity estimates, deadline checks, buffered work-block suggestions |

```text
app/                     Dashboard, connection setup, API routes, and MCP endpoint
lib/                     Planning, source readers, account registry, and persistence
lib/planning.test.mjs    Planning and calendar normalization tests
db/                      Drizzle schema and D1 access
drizzle/                 SQL migrations and schema metadata
build/                   Sites runtime and connector preview integration
scripts/                 Portable install, build, and preview support
.openai/hosting.json     Existing Site identity and connector declarations
public/                  Icons and web app manifest
```

## Run locally

Use Node.js **22.13 or newer** and npm. Start from a fresh clone:

```sh
git clone https://github.com/RobBrown7/Partheanon.git
cd Partheanon
npm run install:ci
npm run build
```

Initialize the local D1 schema, applying each migration once to a new development database:

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_early_puma.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_yummy_black_bird.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_windy_red_wolf.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_large_maggott.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_aberrant_tusk.sql
npm run dev -- --port 5173 --hostname 127.0.0.1
```

Open `http://127.0.0.1:5173`. Local sign-in uses a development identity. Live connector reads require a Sites preview relay and the visitor's authorized connections; without it, source errors are expected. A clean clone has no personal source data. Stop the preview relay before packaging a production build.

The existing `.openai/hosting.json` belongs to Forge's Site. Its IDs are configuration, not access credentials. A separate deployment needs its own Site registration, authenticated hosting environment, database bindings, and connected-app consent. Do not publish an independent deployment against the original Site identity.

## Validate

```sh
npx tsc --noEmit
node --test lib/planning.test.mjs
npm run build
```

Planning tests cover overlapping calendars, transparent events, all-day and weekend availability, cumulative deadline feasibility, buffered suggestions, timezone normalization, and canceled or duplicate events.

Production publishing uses the Sites workflow: check connector eligibility, build and package the exact source commit, publish a saved version, and verify deployment status. The GitHub repository itself does not deploy the app.

## Privacy and source preservation

The app stores tasks, work blocks, preferences, setup records, and cached source reads under the authenticated user's identity. Mutating browser requests require the same origin. Provider actions and additional-account lookups are selected by server-owned definitions.

This repository includes source configuration and account-specific defaults needed to preserve this version. It excludes OAuth credentials, tokens, environment secrets, database contents, source caches, actual work records, personal inbox/calendar/meeting-note exports, screenshots, build output, and local agent state. Schema migrations are included; personal database records are not.

Never commit real data to fixtures or documentation. `.gitignore` prevents common local artifacts from being added, but inspect staged changes before every push.

## Direction for future work

1. Support independent, simultaneous accounts wherever provider authorization permits.
2. Expand Notion workspace and database coverage with explicit access and completeness reporting.
3. Add background synchronization, change notifications, and stronger freshness guarantees.
4. Enable Aegis to help track commitments and protect work time through an authorized integration.
5. Add deliberate calendar write-back and mobile improvements with clear user control.

These are product goals, not claims of current functionality.

## Version provenance

This GitHub snapshot is based on the dark-mode release from October 7, 2026, at Site source commit `bc4ab81d3af90bffe1e809a93228af1a9422c8f1`. It includes the complete tracked source and refreshed repository documentation. The Site's prior deployment history remains in its separate source repository; this archive does not import historical runtime data or credentials.

Project creator: **Rob Brown (Forge)**. Planning partner: **Aegis**. No project-wide open-source license has been selected. Included third-party license notices remain in `build/` and `vendor/`.

## Aegis chat

Ask Aegis is available throughout the dashboard, including on mobile. The server uses the OpenAI Responses API (`gpt-5.4-mini`) with user-scoped, bounded dashboard context: commitments, calendar events, protected blocks, recent work logs, and capacity analysis. Raw inbox and Notion page bodies are not included. The conversation lasts for the current browser tab. API requests set `store: false`.

Aegis can propose commitments and subtasks, actual work entries with AI-assisted minutes and skills, and internal protected time. Review each proposal and choose **Confirm & save**. Server-stored proposals expire after 30 minutes, reject changed task baselines, and are claimed once before applying existing ownership, hierarchy, time, and conflict checks. Confirmed work blocks can be exported through the existing calendar export.

Configure `OPENAI_API_KEY` as a secret in the hosting environment; keep local development credentials in ignored `.env.local`. Never place credentials in browser code, backups, or this repository. A valid API project with billing is required. Chat requests are limited to six per user per minute.

Local database additions:
```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_needy_forge.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_typical_edwin_jarvis.sql
```

## Connection troubleshooting

Connections → **Check account routing** reads each declared service's profile independently, reports the actual selected email, and compares it with configured accounts. Account identity verification is separate from calendar/mail data verification. The authenticated `/connection-diagnostics` page exposes the request's provider tool schema under technical details. It does not expose credentials or modify consent.

As verified October 8, 2026, hosted Sites profile tools have no `link_id` account selector, while direct Gmail and Google Calendar plugin tools support multiple account links. The Site consent screen selects one account per service. A saved additional-account record cannot change that routing. Never remove the email identity check to disguise a mismatch. Continuous refresh from all accounts requires an integration that supports separate account routes.

## Direct Google and Microsoft connections

Connections → **Direct account connections** supports one app registration per provider and a separate OAuth grant per configured account. Register a Google Web application with Gmail API and Google Calendar API enabled, or a Microsoft Entra Web application supporting organizational and personal Microsoft accounts. Copy the exact callback URI shown in the setup panel. Enter the client ID and secret in that private form, never in chat or repository files.

Server secret `OAUTH_ENCRYPTION_KEY` is a base64url-encoded 32-byte random key. Client credentials and refresh/access tokens are AES-GCM encrypted in D1 with ownership/provider/account authenticated data. Keep this key stable: replacing it requires reconfiguring registrations and reconnecting accounts. API status and backups exclude credentials and tokens. OAuth uses PKCE, an expiring single-use state tied to the signed-in owner, and an exact provider email check. Refreshes use a per-account database lock. Requests use read-only Gmail/Calendar and Microsoft Graph Mail.Read/Calendars.Read permissions.

After a direct grant, that account's source reads use its own tokens rather than the Site's single-account plugin route. Accounts without direct grants retain the existing plugin route. Direct errors retain saved snapshots and do not silently switch accounts. Read windows and inbox limits remain bounded and are reported as partial when appropriate. Refresh currently runs every five minutes while the dashboard is open; unattended refresh and push subscriptions are not implemented.

Google External apps in Testing need each intended email added as a test user and may issue refresh tokens that expire after seven days. Wider public distribution using Gmail restricted scopes requires Google's applicable verification. Microsoft organizational policies can require admin consent. The connection panel separates authorization from verified data reads.

Additional local migrations:
```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0007_mysterious_wonder_man.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0008_fat_sasquatch.sql
```

Provider flow references: [Google Web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) and [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
