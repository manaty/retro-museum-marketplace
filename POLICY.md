# Retro Museum catalog policy

Version **2026-09-07.1** · Effective 7 September 2026.

This is an independent, versioned policy for open-source museum activities and at-home shared-screen games. Its structure is inspired by the [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and the [Google Play Developer Policy Center](https://play.google/developer-content-policy/), consulted 7 September 2026. Passing our review does not confer Apple or Google approval. Platform-specific billing, native SDK and account rules are not copied into this web-game contract.

## Acceptance rules

| Rule | Requirement |
|---|---|
| SAFE-01 | No exploitative sexual content, hate, targeted harassment, scams, encouragement of real violence, dangerous instructions or real-money gambling. Non-graphic fictional conflict is considered in context. |
| KIDS-01 | Honest age recommendation and content descriptors; protect children. Our age advice is not an official age classification. |
| PRIV-01 | No tracking or additional personal-data collection. Use host-managed profiles only. Keep player secrets private. |
| SEC-01 | No malware, hidden permissions, credential requests, evasion or deliberately opaque behavior. |
| RIGHTS-01 | Open-source license, complete attribution and lawful rights to code, images, audio and branding. Declare generated assets and their provenance. |
| QUALITY-01 | Complete, playable activity with truthful metadata, instructions and usable controls; no broken placeholders or spam duplicates. |
| MUSEUM-01 | Clear educational, historical, creative or social value for a museum group and at-home replay. |
| UX-01 | Legible display and usable phone interface. Accurate languages. Warn about strong motion/flashing; allow host audio control. |
| BUSINESS-01 | SDK v1 games are free of ads, purchases, tracking, paywalls and external service requirements. Dedicated hosting is a separate offer. |

The executable rule definitions in `policy.js` are supplied to the reviewer. Changes receive a new policy version and require explicit creator acceptance.

## Submission and review

1. Authors prevalidate a committed build using the official Action. This checks compatibility, not acceptance.
2. A submission contains a public GitHub URL and content/rights declarations. The service records an immutable commit and artifact SHA-256 and independently repeats technical checks. It does not run repository installation, workflows or build scripts.
3. Valid submissions receive a Manaty fork and a reference to the reviewed commit. A fork is a review copy, not an endorsement. Workflow execution is disabled on review forks.
4. An AI returns a finding and evidence for each rule. Repository content cannot instruct the reviewer or trigger tools. Missing evidence, unsupported media, refusals or service errors cause **needs_review**, never automatic approval.
5. Only an approved immutable artifact appears in the catalog. New commits do not change installed museum sessions. Rejected and uncertain submissions remain unpublished with a readable report.

## Scope and human review

Automated lifecycle checks and source/image review do not prove every game path is correct. The initial reviewer captures the first shared-display and phone screens in an isolated browser, but does not autonomously play every interaction, verify ownership of assets or listen to audio. Incomplete source/image coverage, any unreviewed audio or uncertain findings require human review. An authorized reviewer must record a reason and the exact artifact hash for an override; the original findings are retained. A developer can correct the game and resubmit a new commit, or request reconsideration through a marketplace repository issue referencing the report ID. The report should not contain secrets, personal data or copyrighted source excerpts.

Maintainers can withdraw a catalog version after a substantiated report. A withdrawal removes it from new installs; administrators receive the reason and decide how to handle an installed copy. Security emergencies may require disabling a compromised version explicitly. Report a concern using the repository's issue form; do not include player personal data.

## Publisher previews

The collection also links to Manaty’s own playable releases, explicitly labelled **Manaty · Public preview**. They are configured and version-pinned by the publisher, rather than accepted through the community submission pipeline. Their source code and play links are public. This label does not assert an independent AI or human content approval; earlier community review findings remain available and unchanged. Preview packages are not automatically installable as approved community submissions. The community review requirements above remain unchanged.
