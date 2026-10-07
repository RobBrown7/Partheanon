# Partheanon

**Your commitments, in perspective.**

Partheanon is a personal command center created by Rob Brown (Forge), with Aegis as the intended planning partner. Its purpose is to bring commitments scattered across work, volunteer, business, and personal communication into one rolling view—and make room to deliver on them.

A commitment connects **a stakeholder, a task, a deadline, a time estimate, and an expected output**. The larger vision is for Aegis to identify conflicts and overcommitment, help prioritize work, and protect the time needed to finish it.

This repository preserves the idea and the working source, including the dark green, sage, and teal interface and the additional connection setup flow. It is a source archive; the live dashboard remains private.

## Current experience

- **Overview and schedule:** a rolling 14-day calendar horizon, busy-event conflicts, work capacity, and deadline risk checks in America/Phoenix time.
- **Commitments:** tasks with a project, lane, stakeholder, deadline, remaining work estimate, status, output, and source link.
- **Projects:** commitments grouped by project and progress.
- **Protected work time:** proposed and saved internal focus blocks, with calendar conflict checks and a 15-minute buffer.
- **Inbox review:** recent Gmail and Outlook inbox candidates with rule-based importance signals; review is required before turning them into commitments.
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

Aegis integration is exposed through Site MCP tools for reading commitments, analyzing workload, saving commitments, and protecting work blocks. Direct use requires the Site plugin and workspace permissions; availability depends on the deployment workspace's permissions. The dashboard's capacity checks are deterministic rules, with no embedded model API call or API key.

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

This repository includes source configuration and account-specific defaults needed to preserve this version. It excludes OAuth credentials, tokens, environment secrets, database contents, source caches, personal inbox/calendar/meeting-note exports, screenshots, build output, and local agent state. Schema migrations are included; personal database records are not.

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
