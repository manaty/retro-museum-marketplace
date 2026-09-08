# Visual release QA — Chess and Sketch 1.1.0

Independent publisher QA performed by Codex (automated agent), September 2026.

Chess now uses original vector piece silhouettes, shaded ivory/slate pieces, an emerald board, animated moves, visible capture targets, prominent player clocks and a trophy/confetti result scene. Sketch now uses an illustrated studio theme, dotted drawing surface, colourful score cards, redesigned drawing tools, animated word reveals and a trophy/confetti podium. Vector artwork is original code, not downloaded imagery. Rendering remains offline.

Validation on the built 1.1.0 packages:

- 21 Chess engine/host tests and 16 Sketch engine/host tests pass, including complete matches, restoration, no-winner outcomes, host replay and late-player inclusion.
- Two additional committed browser suites exercise 18 configurations: display 960×540, 1280×720 and 1920×1080; controller 320×568, 390×844 and 844×390; Chess with two players, Sketch with two/eight players. Canvas aspect ratio, visible bounds and horizontal fit pass.
- Browser tests confirm reduced-motion disables all 21 trophy/confetti animation elements, and twelve identical server states cause zero canvas repaints. These suites are part of each game's GitHub workflow.
- Interactive Edge sessions exercise a shared display and two controllers: seven chess moves through checkmate, and Sketch word selection, pointer drawing, secret-word isolation and a submitted correct guess. EN/FR/TL switching, sound preferences and missing fullscreen APIs pass without page errors.
- Independent SDK prevalidation passes at the declared player limits. Screenshots in each game's `docs` directory are captured from actual browser sessions and were visually inspected.

These checks do not certify physical older TVs, Android hardware, eight physical phones, all chess tournament rules, audible sound quality or exhaustive accessibility. Existing casual-game rule limitations remain in the game READMEs. Animations are finite, do not flash and respect reduced-motion preferences. Match engines and network protocols are unchanged.
