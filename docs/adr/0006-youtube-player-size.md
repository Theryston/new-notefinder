# 6. The YouTube player is a 100x100 square

- Status: accepted
- Date: 2026-10-13

## Context

Everyone hears a Track on the practice page through its chosen YouTube video.
The page is about the notes, not the video, so the design (the "Dock" draft of
spec #160) shows the video as a small square in the floating dock instead of a
large player.

YouTube's Required Minimum Functionality (RMF) for embedded players asks for a
viewport of at least 200x200 px, nothing drawn in front of the player, and the
player visible before scripted playback starts. A 100x100 player breaks the
first rule. YouTube can answer that by restricting the embed or the API key,
which would stop playback for every visitor.

## Decision

- The player is a **100x100** square in the dock, accepted by the maintainer
  as a known risk.
- The size is **one constant**, `YOUTUBE_SQUARE_PX` in
  `apps/web/features/tracks/player/player-port.ts`. The dock, the player and
  the tests read it. Raising it to 200 is a change of that number, with no
  redesign of the dock.
- **Hiding the video pauses the music.** YouTube may not play a hidden player,
  so "Hide video" pauses, and pressing play shows the video again before it
  plays (the player is started after the reveal has been drawn).
- Nothing is drawn over the player: the dock's controls sit beside it.

## Consequences

- If YouTube restricts the embed or the API key, playback stops until the
  constant is raised to 200 (or the restriction is lifted). The dock shows an
  error message when the player cannot start, so the page does not stay in a
  loading state.
- The 200 px square needs more room in the dock, mostly on phones, so the
  phone layout (play and progress on top, the video beside a column of
  controls) would have to be revisited if the constant is raised.
- The risk is watched, not removed: this decision is revisited if YouTube
  contacts us or embeds start failing.
