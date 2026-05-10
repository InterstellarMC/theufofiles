# UFO Archive – Test Plan (PURSUE Release 01 polish round)

Preview URL: https://dist-yrxkdlqx.devinapps.com

## What changed (user-visible)
1. UTube video player now opens in a full-page YouTube-style layout (top bar with brand + search, big player, title, channel row with Subscribe, like/share/save buttons, expandable description, **worldwide comments section**, related-video sidebar). Previously it opened in a small dark modal that did not maximise.
2. UPhotos has a new top-level tab "Embedded in documents (190)" that surfaces images extracted from the released PDFs. Previously only the 14 official photo releases were shown.
3. Umeni (the AI) now answers broader query types: definitions ("What does PURSUE stand for?"), counts/year buckets ("How many sightings in 2025?"), agency/type collections ("Show me FBI photos"), most-recent ("Where did the most recent UAP sighting occur?"), and comparisons ("Compare the Gemini 7 and Apollo 11 sightings"). Each answer ends with 3 follow-up suggestion chips.

## Primary flow

### Test 1 — UTube YouTube-style player + worldwide comments
1. Navigate to UTube (dock).
2. Click any video card.
3. **Assert (player layout)**: a full-screen overlay opens with (a) a top bar containing a back arrow, the red "play" glyph, and the word "UTube"; (b) a 16:9 video player taking the top-left of the page (≥600px wide on a desktop window); (c) a title row showing the video title in larger weight; (d) a channel row with an agency-coloured circular avatar, a subscriber count, and a white "Subscribe" pill; (e) action pills "Like / Share / Save / Download". The previous small-modal layout (semi-transparent black overlay with a tiny video on the left and short text on the right) MUST NOT be present.
4. **Assert (related sidebar)**: the right column shows ≥3 related video cards, each with a 16:9 thumbnail, duration badge, title (≤2 lines), channel name, and "X views · …" line.
5. Scroll down to the comments section.
6. **Assert (comments)**: a "Comments" header with a count, a compose row that says "Add a comment...", and a list of ≥10 comments. Each comment must show: an avatar circle with initials, a name, a place (e.g. "Tokyo, Japan", "Paris, France"), a relative time ("X days ago"/"X weeks ago"), the comment text, and a row with thumb-up icon + numeric like count + "Reply" link.
7. Type "Just landed on this page — wow" in the compose input and click "Comment".
8. **Assert**: the new comment appears at the top of the list authored by "Donald J. Trump · White House, USA · 1 day ago" with the typed text. (Persists in localStorage.)
9. **Assert (video element)**: a `<video>` tag is present with the video URL set; `controls` attribute is present; `autoplay` was set so the file is buffering or playing.

If any of (3), (4), (6), or (8) fail, the feature is broken.

### Test 2 — UPhotos "Embedded in documents" gallery
1. Navigate to UPhotos (dock).
2. **Assert**: two top tabs are visible: "Official photo releases (14)" and "Embedded in documents (190)". The Official tab is active by default.
3. Click "Embedded in documents (190)".
4. **Assert**: the grid now shows >100 image tiles. Below the tab row, there is a chip row starting with "All (190)" plus per-agency chips (e.g. "Department of War (X)").
5. Click any tile.
6. **Assert (lightbox)**: a large image opens with a caption containing the parent PDF title (e.g. "DOW-UAP-D14, Mission Report …"), the agency · location · date triple, and a "↪ Source PDF" link plus an "Open record" button.
7. Close the lightbox.

If (2), (3), (4), or (6) fail, the feature is broken.

### Test 3 — Umeni broader queries
1. Navigate to Umeni (dock).
2. Submit query: "What does PURSUE stand for?"
3. **Assert**: the response begins with **PURSUE** and contains the literal phrase "Presidential Unsealing and Reporting System for UAP Encounters". This is hard-coded in the new DEFINITIONS map; a broken implementation that fell through to keyword-search would NOT produce that exact phrase verbatim.
4. Submit query: "How many sightings in 2025?"
5. **Assert**: the response begins with a number followed by "record" or "records". A list of records below shows year 2025 dates. (Falsifiability: a broken implementation that didn't recognise the year window would either return the generic keyword fallback or count all records, not just 2025.)
6. Submit query: "Compare the Gemini 7 and Apollo 11 sightings."
7. **Assert**: the response is a 3-column table with the headers "Subject / Records / Notable detail" and at least 2 rows containing "Gemini 7" and "Apollo 11". A broken implementation would return a flat list, not a table.
8. **Assert (follow-ups)**: every Umeni answer ends with a "Follow up" label followed by 3 clickable chips. Click one and verify it submits a new query and renders a new bubble.

If (3), (5), (7), or (8) fail, the feature is broken.

## Regression (label clearly)
- Witness click still opens the witness modal (e.g. Frank Borman → records list).
- UEarth map still loads with sighting markers.
- UCalendar still groups by year and clicking a year heading still works.

## Out of scope
- Mobile responsive layout (<960px).
- Cross-browser test (only Chrome).
- Real video playback content review (we only verify a `<video>` element exists with a URL).
