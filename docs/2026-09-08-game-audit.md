# Sketch and Chess publication audit — 8 September 2026

Performed by Codex, an automated coding/test agent, at the publisher's request. This is not a human certification, exhaustive security audit or physical-device compatibility guarantee.

## Exact tested releases

| Game | Commit | Package SHA-256 | Automated game tests |
| --- | --- | --- | --- |
| Chess 1.0.1 | `65fcb8f94b742ccc5743c0b4aa69e272e1100837` | `786fc9fac2790834c8742637bc336b4de81fc9d892adbd8b70f75bf96e7eebb3` | 21 passed |
| Sketch 1.0.1 | `e80632f140843835ad6917190bafcb59159159113d5` | `abedee9dcc9ccc29241e9267a7d390f29f0872d87dec737148e0cd188bfce5ad` | 16 passed |

Both committed artifacts independently passed the SDK validator and the repositories' GitHub workflows. The public host lists exactly these hashes. Downloadable GitHub releases include the same package.

## Defects found and corrected

- Both adapters omitted `status().ended`. Draws and zero-score matches could stop internally without completing the host lifecycle. Packaged QuickJS and actual RoomParty regression tests now cover completion, restoration and replay with a late connected player.
- Chess repetition identity incorrectly included an uncapturable en-passant square. It now considers only legal en-passant captures, including pinned-pawn cases. FEN move counters are retained.
- White's blitz clock did not start until the first move. It now starts when the host starts play. A bare king no longer wins on time. A previously unconditional test assertion now checks real legal moves.
- Added mute controls using host-persisted sound preferences, dynamic translated header labels and a guarded fullscreen fallback. Reduced the chessboard to fit the available shared-screen height.
- Replaced the misleading claim of all chess rules/draws with a documented casual ruleset.

## Interactive evidence

A headless Microsoft Edge browser ran the packaged view in an opaque iframe, with one 1280 × 720 display and two independent 390 × 844 controller pages. Actions were delivered to the isolated QuickJS engine and resulting public/private states returned to each view.

- Chess: selected and moved pieces through a seven-move checkmate, including black's reversed orientation; confirmed the winning state.
- Sketch: selected a secret word, drew a stroke with pointer events, confirmed the public canvas received it, checked that the guesser did not receive the secret word, and submitted a correct guess through the phone form to reach reveal.
- Both: switched EN/FR/TL, checked horizontal fit, toggled persisted sound preference, clicked fullscreen with the standard and WebKit request APIs removed, and collected no page errors.
- Screenshots were visually inspected and committed in each game's `docs/` directory. They show actual browser output, not generated mockups.

The deployed HTTPS/WebSocket host was tested separately using two authenticated synthetic players and a display for each game. Chess completed checkmate; Sketch completed both drawing turns with correct guesses. Both entered their winning state and accepted a phone's replay command, creating a new match. Test matches were then ended and sockets disconnected so their shared slots could be released automatically. No real visitor session was modified.

## Remaining quality limits and recommended guidelines

The games are functional initial releases. Graphics are readable but modest: richer piece transitions, round/winner animation and stronger visual feedback would improve the museum experience. This audit did not add a visual redesign.

Chess is casual: automatic threefold/fifty-move draws, no draw claims/offers or resignation; not every blocked dead position or impossible-mate timeout configuration is detected. Sketch's vocabulary is a starter list and deserves native-language editorial review, especially Tagalog. Free drawings and guesses are not automatically moderated.

Older physical TVs, Android hardware, eight simultaneous physical Sketch phones, a long-running load test, comprehensive keyboard/screen-reader access and audible sound quality were not tested. Source-generated sounds and mute behavior were inspected/tested, not acoustically certified. The local browser harness is controlled test infrastructure; author-supplied scripts are never executed by marketplace submission review.

The SDK now contains [GAME-QUALITY.md](https://github.com/manaty/retro-museum-sdk/blob/main/GAME-QUALITY.md): lifecycle including no-winner outcomes, host replay, secret-state isolation, reconnect/spectator cases, exact artifacts, truthful rules, localization, touch/TV layouts, sound controls and evidence requirements. The previous SDK API documentation itself omitted `ended`, contributing to the adapter defect.

## Submission exercise

Chess was submitted using the actual public website form; Sketch through the public POST endpoint. A duplicate Sketch POST returned the same receipt. The service independently fetched each fixed commit, validated the package and rendered both roles, then called its configured AI reviewer. Both first reviews passed eight policy rules but stayed `needs_review` for missing interactive evidence. This confirms that initial screenshots no longer count as a completed playthrough.

- [Chess receipt](https://retro-museum.net/api/reports/1e9c87d67a0c30bc3f2622fbdb417738)
- [Sketch receipt](https://retro-museum.net/api/reports/41a179ed59c1272020c6cc6ee11cb7e9)

These official repositories exercise the existing-Manaty-repository branch. Creating an external contributor's fork was not exercised against GitHub in this run. The pipeline's isolated failure/success tests cover the expected validation→fork→review→publication order; they are not a substitute for a real external-fork test.

Authenticated test evidence must be tied to the exact hash and source commit, stored outside the author's intake, and identify whether the reviewer was an agent or a human. The independent editorial review remains authoritative and may reject despite passing gameplay tests.
