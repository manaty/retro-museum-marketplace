# Retro Museum marketplace

Open-source creator submission service, independent technical validator, Manaty review forks and AI editorial review. The creator toolkit is [manaty/retro-museum-sdk](https://github.com/manaty/retro-museum-sdk); the first packaged activity is [Werewolves](https://github.com/manaty/game-werewolf).

## Run locally

Node 22 or later. Run `npm ci --ignore-scripts`, then `npm start`. Open http://localhost:4320. Data lives under ignored `.local/`. Without reviewer credentials submissions stay in `needs_review`; they are never silently approved. Run `npm test` for policy, gating and pipeline tests.

## Creator workflow

1. Build and commit `retro-museum.json` and `dist/game.rmg.json` using the SDK contract.
2. Add `uses: manaty/retro-museum-sdk@v1` to a read-only workflow. See the SDK's complete example and pin a release SHA when needed.
3. Submit a public repository URL and content/rights declarations from the marketplace page. The default branch is resolved once to a full commit SHA. The server never trusts an author's Action result.
4. The service downloads only fixed paths at that commit. A time-limited subprocess validates the engine in QuickJS WASM without host APIs. No submitted npm scripts, builds or GitHub workflows run.
5. A technically valid submission gets a Manaty review fork (official Manaty repositories are reused). Review forks have Actions disabled and a `review/<commit>` branch. Forking never means acceptance.
6. AI findings cover every rule in [POLICY.md](POLICY.md). Rejections and uncertain cases remain unpublished with a public report. New releases require another submission. Independent gameplay evidence is required in addition to initial screenshots; see below.

## Review limits

Version 0.1 reviews source (up to 220,000 characters), up to six asset images and rendered initial display/phone screenshots. A separate browser process blocks external requests and loads the game in an opaque sandboxed iframe; the process has no reviewer secrets and a 25-second deadline. The screenshots are a startup compatibility check, not a complete interactive playthrough. The current worker does not run an interactive match through completion and replay. Game submissions therefore stay in `needs_review` even when source and initial-screen findings pass; an authorized operator or trusted test agent must supply the missing gameplay evidence. Evidence from an authenticated independent runner can complete the coverage before a fresh AI review; it cannot override a rejection. This restriction does not affect the separate fixed-engine quiz-content pipeline. Truncated code, additional images, any unreviewed audio, failed rendering or uncertain AI findings require human review. It does not claim store certification, complete security auditing, proven asset ownership or exhaustive gameplay coverage. Approved entries expose a Play link to Manaty Play, which verifies and loads the published package for standalone multiplayer rooms. The six bundled museum activities also run through their independent game repositories. Installing arbitrary community activities into the museum admin UI is a separate integration.

An authorized operator can record a decision using `REVIEWER_NAME="Name" CATALOG_BUCKET="bucket" node review-decision.js REPORT_ID EXACT_SHA256 approve|reject|withdraw "Detailed reason"`. GCP application-default credentials must authorize catalog writes. There is no public approval route. The artifact is downloaded again and checked before approval. Original AI findings and an immutable decision record are retained. Catalog withdrawal excludes the version from new catalog listings; already-downloaded artifacts remain addressable, and this service does not remotely disable installed museum games.

## GCP deployment

Use separate Cloud Run services from the same Docker image:

- Public web: `SERVICE_ROLE=web`, read-only catalog bucket, intake bucket, Cloud Tasks enqueue permission. **No GitHub or OpenAI secrets.**
- Private reviewer: `SERVICE_ROLE=reviewer`, Cloud Run IAM authentication, read-only intake and write access to catalog. One concurrent task, bounded requests, distinct service account.
- Task caller: only Cloud Run invoke permission on the reviewer. Public web may enqueue OIDC calls using this identity.
- `INBOX_BUCKET`, `CATALOG_BUCKET`, `TASK_QUEUE` (full resource path), `TASK_CALLER`, `REVIEWER_URL` configure the services. `OPENAI_API_KEY`, `REVIEW_MODEL` and `GITHUB_PUBLISH_TOKEN` belong only to the reviewer. Secrets stay in Secret Manager, never Git or the public web service.

Prefer a dedicated GitHub App installation token limited to the publisher's organization and required repository/fork permissions. A provisioned OAuth token is supported, but inherits that account's scope and must be rotated/replaced when a dedicated App is available. No game receives it; the validation child has an empty environment.

The initial intake is capped at ten new immutable source commits per UTC day, enforced with atomic storage creation. Review requests are serialized through Cloud Tasks. This is a small launch configuration, not an abuse-proof public scale guarantee. Operators can retry failed infrastructure jobs or ask authors to resubmit a corrected commit. GCP, GitHub and OpenAI usage may incur hosting/review costs even when the game catalog is free.

## API

- `GET /api/policy`: version and rule definitions.
- `POST /api/submissions`: `{repository, declarations}` → report ID.
- `GET /api/reports/:id`: technical report, fork, evidence, editorial decision.
- `GET /api/catalog`: reviewed games and explicitly labeled publisher previews with immutable SHA-256 references.
- `GET /packages/:sha256.json`: previously approved package.
- Private `POST /process`: queue-driven review, protected by Cloud Run IAM.

An authenticated operator may rerun a completed report by posting `{id,retryReason}` to the private reviewer. A substantive reason is required and the original report is archived before rechecking the same immutable commit. Normal duplicate task delivery does not repeat completed work. This override is not exposed by the public submission form.

Submitter declarations are private intake data. Reports expose repository, commit, package metadata and review findings, not API credentials or player data. See POLICY.md for appeals and content reports.

## Quiz questionnaires

Authors copy the [AI prompt](https://retro-museum.net/quiz-prompt.txt), append their topic and audience, and ask an assistant to generate and submit JSON. No application repository is required. Assistants with HTTP access use `POST https://retro-museum.net/api/quizzes/submissions`; otherwise the author uploads the JSON at `/quizzes`.

`GET /api/quizzes/schema` describes the exact limits and publication declarations. Intake permits 1–1,000 questions within 10 MB, four choices and one correct answer, and optional PNG/JPEG images up to 100,000 bytes and 2048 pixels per side. The public API has no secret token. Atomic storage caps new quiz reviews at 20 per UTC day and deduplicates repeated submissions. A receipt links to `/api/reports/:id`.

The private reviewer checks every question and image in bounded batches, including correctness, ambiguity, translations, audience and the content policy. Incomplete or uncertain reviews remain unpublished; authors may correct and resubmit them. AI review is not independent source verification. Approved data is packaged with the fixed, technically validated Quiz engine, never author-supplied executable code. `/api/quizzes` lists downloadable built-in and approved questionnaires; `/api/catalog` also exposes approved quiz activities to the online host. The existing repository review-decision CLI is not a quiz approval tool.

The deployed pipeline approved and published the original ten-question fruit starter on 2026-09-08: [public report](https://retro-museum.net/api/reports/158dabd191488afa9e35c96c51232a4e).

## Games, categories and content packs

The storefront uses `GET /api/marketplace` (schema 2): `games` and `packs` are separate lists. Games have one to three controlled categories and a `content` requirement. New game submissions can include a `categories` array; old clients default to `other`. Category metadata is preserved in the review report and approved entry.

Quiz is the first content-pack adapter (`quiz-v1`). Its four starter questionnaires and approved community questionnaires are packs, not separate storefront games. Quiz requires at least one selected pack. Other games currently include their original content; this release does not add downloadable Kart circuits or Werewolf scenarios.

`POST /api/selections` takes `{gameId:"quizz",packIds:["builtin-flags","builtin-capitals"]}` and returns a tracking path. The public web only queues the request. The private worker resolves approved immutable content, checks compatibility and integrity, and prepares a technically validated game package containing only the selected question bank. The engine used for content packages contains no unselected starter questions. A selection accepts 1–10 different packs and at most 1,000 questions in the bank; preparation draws 1–100 questions for a game.

`GET /api/selections/:id` provides a ready selection's play URL, immutable package download and content-only download for the museum's existing private questionnaire import. An SDK-compatible host can run the `.rmg.json` package with `retro-museum-host --package FILE`. The content-only `.quiz.json` works with Quiz already installed in the museum. No new Android APK is required for that import.

Selections are deterministic by engine version and selected pack hashes, so duplicate requests reuse the same preparation. New preparations are capped at 50 per UTC day. Approved content is not sent through AI again just to combine it. Withdrawing a pack removes dependent selections from new discovery; existing running rooms retain their pinned versions. The schema-1 `/api/catalog` keeps prepared entries and legacy questionnaire activities for host compatibility, while the storefront lists each game only once.

## Family difficulty and large banks (0.4.0)

Banks accept up to 1,000 questions with a strict total of 10,000,000 UTF-8 bytes (including encoded images and submission metadata). Images retain the 100,000 decoded-byte limit. New submissions require difficulty 1–4 per question; the AI checks the level as well as the answer. Old content without difficulty keeps its hash and is marked unclassified.

Preparation chooses a level range or percentage mix and 1–100 questions for the playable package; the separate museum content download retains the full selected bank. Exact integer quotas use largest remainder rounding and fail on a shortage instead of borrowing from another level. A prepared percentage mix pins its question count so changing the host settings cannot silently distort the proportions.

Review checkpoints after each batch of 20 questions. A worker processes up to four batches per invocation and returns a retryable response when more remain. Cloud Tasks resumes it (maximum 20 attempts within two hours), retaining completed question assessments. An incomplete review never publishes a bank. For banks larger than 100 questions the full content is validated and reviewed, while technical execution checks use a representative fixed-engine package; users prepare a playable selection separately.

## Website languages

The storefront and quiz studio offer English (default), French and Tagalog. The language selector remembers the choice locally; ?lang=fr and ?lang=tl select a language for a shared link. Interface changes preserve form values and selected content packs. Author-provided content uses its available translations; original technical review evidence is not machine-translated in the browser.

## Independent interactive evidence

The public submission endpoint never accepts trusted test attestations. Only an authenticated operator/test runner with private catalog write access can store `playthroughs/SHA256.json`. `playthrough.js` requires matching package hash and source commit, named human/agent reviewer, timestamp, all required scenario results and a public evidence report. The pipeline ignores any author-declared playthrough and records the authenticated evidence in the public report. An operator may then request a private retry of the same immutable submission; original findings are archived and the AI reevaluates every policy rule. Passing gameplay evidence alone never approves content.

Reviewed official packages replace publisher previews only at the matching repository and hash. Withdrawing that reviewed hash also removes its preview from discovery. Existing rooms and downloaded artifacts retain their pinned versions.

See [the Sketch and Chess audit](docs/2026-09-08-game-audit.md) for tested scenarios and explicit limitations.
