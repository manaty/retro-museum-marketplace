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
6. AI findings cover every rule in [POLICY.md](POLICY.md). Rejections and uncertain cases remain unpublished with a public report. New releases require another submission.

## Review limits

Version 0.1 reviews source (up to 220,000 characters), up to six asset images and rendered initial display/phone screenshots. A separate browser process blocks external requests and loads the game in an opaque sandboxed iframe; the process has no reviewer secrets and a 25-second deadline. The screenshots are a startup compatibility check, not a complete interactive playthrough. Automatic publication requires all these checks and favorable findings for every policy rule. Truncated code, additional images, any unreviewed audio, failed rendering or uncertain AI findings require human review. It does not claim store certification, complete security auditing, proven asset ownership or exhaustive gameplay coverage. The current service is the creator/review/catalog foundation; hosted multiplayer rooms and museum installation UI are separate integration work.

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
- `GET /api/catalog`: approved and non-withdrawn games with immutable SHA-256 references.
- `GET /packages/:sha256.json`: previously approved package.
- Private `POST /process`: queue-driven review, protected by Cloud Run IAM.

Submitter declarations are private intake data. Reports expose repository, commit, package metadata and review findings, not API credentials or player data. See POLICY.md for appeals and content reports.
