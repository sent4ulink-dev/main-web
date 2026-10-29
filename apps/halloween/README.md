# A Spooky Quest

A mobile-first Halloween date invitation. Eight scenes, a five-heart maze, inline owner editing, and browser-only plan sharing. The page is static; a small server keeps saved content and the permanent editing lock in a storage bucket. It is one of the 56 Moments WebCards: 56moments.com sells its links.

## Preview

Run `npm ci`, `npm run build`, then `npm run dev`. Open `http://127.0.0.1:5173` (`PORT` changes the port). Set the server-only `STUDIO_PASSWORD` environment variable in your shell for studio access. The loopback preview serves the page and the same API as production on one address, with the invitations kept in a file in ignored `.sites-runtime/`.

## Hosting

Like the other 56 Moments WebCards, in three parts:

| Part | Where | Notes |
| --- | --- | --- |
| Page | Cloudflare Pages, `halloween.56moments.com` | Build `npm run build`, output `dist/client`. The build writes the API's address into `config.js` (`API_BASE` overrides it). |
| API | Render web service, `node server/render.js` | No packages to install. Settings are listed at the top of `server/render.js` and in `render.yaml`. |
| Storage | R2 bucket `halloween-shares` | `shares/<id>.json` per link, `studio/draft.json`, `attempts/` for wrong studio passwords. |

56moments.com sells links to this invitation. It mints the id (the same 32-character form the studio uses), then asks `POST /api/invitations/<id>/ensure`, which makes the invitation from the built-in words for the coming Halloween. The call needs no secret: the server asks the store's `/api/webcard-verify/<id>` whether it sold that id (`SHARE_CREATE_SECRET`, sent as `x-halloween-create-secret`, skips the question). A sold link opened before that call arrived is made on opening, after the same question. When the store takes a link back (a deleted account, a clean start), it asks `DELETE /api/invitations/<id>`, and the invitation is removed only if the store itself says it took that id back.

## Personalize

URL modes are selected on every page load; browser back/forward reloads the selected mode:

| URL | Behavior |
| --- | --- |
| `/` (no share parameter) | Private studio password gate, inline draft editing, Save, and Generate link. |
| `/?share=test` | Local demonstration with sample content, editing, complete story/game, exports, and Reset demonstration. |
| `/?share=<id>` | A saved invitation snapshot; link holders may edit for five days unless permanently finished, then continue viewing. |

The studio checks the password server-side, issues a signed short-lived bearer token, and keeps that token only in page memory. Fresh loads always ask for the password; there are no authentication cookies or stored credentials. Password retries are rate limited. Studio routes require the bearer token on every request. Generate link first awaits a successful backend Save, then asks the server to create a snapshot from that exact saved revision. The URL dialog offers Copy Link. IDs contain 192 bits of cryptographically secure randomness, use URL-safe characters, and are inserted with collision retries.

Each link persists its own content, creation time, five-day editing deadline, revision, and finalized state. The five days start at the link's first visit, not when it is made (an opening within a minute of making, which the studio does itself, doesn't count); from then on the deadline never moves. Its unguessable URL is the capability to view and edit that invitation during the window; it cannot access the studio or other invitations. Save returns to preview and keeps Edit available while the window remains open. Finish Editing Permanently asks Yes/No, atomically saves and locks that record, and cannot be undone by the owner or altered client metadata. The backend checks the deadline again in the conditional update, not just on page load. Viewing remains available afterward. Unknown/invalid IDs show Link unavailable; connection failures offer retry without switching modes. The old singleton API is closed.

Test mode uses only the `halloween-date:demo:v1` local storage key. Loading, saving, finishing, and resetting the demonstration never call production APIs, allocate share IDs, or modify real invitations. Reset replaces the local demonstration with a fresh sample, including after a test finish. Messages open their composer only after a user click; no mode sends messages automatically.

Inline editing preserves the original text elements, formatting, and design, with subtle outlines. Previous/Next screen reaches the story screens without playing the maze; game timers pause during editing. The toolbar reserves its own grid row and never overlays content. Failed saves retain current input, and stale revisions cannot overwrite another tab.

The confirmed-plan screen includes activity, full date, local start/end time, place, dress code, and message. Its displayed timezone is also editable inline. All three export actions use this same saved plan. Unsaved changes disable exports until Save succeeds. Calendar requires a valid future start and a later end on the same date; times are exported in UTC using the displayed IANA timezone.

The image export uses a fixed 1080×1920 canvas composition with local background art, the heart ghost, and current plan text. It does not capture the page or its controls. A real PNG File is prepared in advance so a tap can call native file sharing with user activation. Unsupported file sharing downloads a self-contained inline-data PNG; cancellation never causes an unwanted download. No image is uploaded, and no temporary server or object URL is generated. SMS opens the composer only, using iOS `sms:&body=` or Android `sms:?body=` with the complete encoded plan. Calendar downloads a UTF-8, escaped, folded RFC 5545 `.ics` file.

Implementation references: [Web Share activation and files](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), [iCalendar specification](https://www.rfc-editor.org/rfc/rfc5545). Native phone share targets and SMS composer behavior remain controlled by the operating system.

Run `npm test` for URL mode isolation, memory-only password authorization, rate limiting, successful-save-before-link creation, secure IDs/collision retries, snapshot isolation, the first-visit start and enforcement of the five days, irreversible finishing (also when a save arrives with it), links made and removed on the store's word, local demo reset without network requests, unavailable links, inline DOM/style preservation, and matching PNG/SMS/calendar exports. `.qa/plan-export.png` is an ignored visual check of the fixed export design.

## Behavior

- Loading automatically opens the quest after 1.8 seconds.
- Each game generates a fresh connected maze and five randomly placed hearts, with the monster starting in a farthest room. Collect hearts using arrow keys, WASD, or the touch controls while the tiny monster follows through the maze, taking one step every 700 milliseconds. Walls block both characters. Getting tagged returns the ghost to the start while keeping collected hearts, with three seconds to recover. Chasing pauses in hidden tabs and stops after the fifth heart.
- Each heart displays a brief message. The fifth reveals the heart-found scene and invitation.
- Both invitation answers work. “Yes, I’m sure” triggers the supplied jumpscare photo with a short scream before showing a kind response and an optional way back. The scare auto-dismisses after 1.8 seconds, or immediately via Phew/Escape; leaving it stops the scream. Reduced motion shows a static photo for 1.4 seconds.
- Buttons play cute slime plops and magical Halloween chimes; Yes has a happy rising chime and No a ghostly descending note. Audio starts only after interaction. A Sound on/off button mutes all effects, including the scream. The scream stops when the page is hidden.
- A yes continues through confirmation with a large glowing heart and three pink flying bats, date details, and an animated love-letter finale with three sparkling hearts, a swooping pink bat, and a smiling heart-shaped ghost that peeks out of the letter. Reduced motion uses still artwork and keeps the heart ghost visible without floating motion.
- The cat preserves the movement from the supplied video, with its background removed; the happy ghost cycles between gently glowing star eyes, loving heart eyes, and a shy smile. Confirmation uses heart eyes. No reveals a friendly animated “Boo!” visitor. Yes launches a short, twelve-treat candy salute that cleans itself up.
- Border-free storybook scenes sit over a cartoon purple night backdrop, with bubble lettering, candy colors, and rosy ghost cheeks. Regular and direction buttons use green slime shapes; the invitation’s Yes is wrapped candy and No is a small graveyard. Reduced motion disables decorative animations and the flying treats.
- Invitation answers are local to the page session; there is no RSVP delivery. The studio draft and real invitation snapshots persist separately in the bucket; demo content stays in namespaced local storage. PNG, SMS, and calendar exports run in the browser without uploading files.
- Reduced-motion preferences disable decorative motion. Native buttons, focus management, and live announcements support keyboard and screen reader use.

Google Fonts is optional; rounded system font fallbacks keep the site usable offline.

The page uses the current viewport height and safe-area insets. Scenes adapt to their available space; wide screens place artwork beside the content, and the maze keeps its direction controls beside the board. Text enlargement and exceptionally small windows can scroll inside the scene without clipping controls.

## Cartoon backdrop

`dist/assets/cartoon-night.webp` is an original illustration created with built-in image generation and compressed to WebP. Final generation prompt:

```text
Use case: illustration-story
Asset type: standalone landscape background illustration for a cute Halloween date invitation website, approximately 1536x1024 aspect ratio.
Primary request: cheerful magical cute cartoon Halloween night scenery.
Scene/backdrop: violet and grape purple night sky above rounded layered mountain hills. Soft crooked leafless trees frame the left and right outer edges; tiny warm stars and a couple of small distant glowing house windows.
Style/medium: polished kawaii 2D animation background, bold smooth dark plum outlines, soft rounded shapes, mostly flat color with subtle gentle atmospheric shading.
Composition/framing: wide landscape wallpaper. Keep the center 60 percent and top center mostly uncluttered purple negative space for the website interface. Concentrate scenery along the lower third and outer edges. Very sparse tiny stars, no central focal object.
Lighting/mood: warm, cute, cheerful, magical Halloween evening.
Color palette: grape purple #513077, lilac #9466bb, peach #ffd194, pink #ffafd2, small mint accents.
Constraints: This is only a standalone bitmap landscape illustration, never a website screenshot or UI mockup. No moon, no cats, no ghosts, no monsters, no characters, no text, no watermark. Generate exactly one final image.
```

The generated scenery also includes cheerful pumpkins and lanterns. The supplied cat animation is preserved without regeneration.

## Heart ghost sprite

Saved asset: `dist/assets/heart-ghost.png`. Generated with built-in `image_gen.imagegen` in one request, with a transparent background. Final prompt:

```text
Use case: stylized-concept
Asset type: one standalone square transparent bitmap sprite for a cute cartoon romantic Halloween invitation.
Primary request: exactly one kawaii ghost whose cream-white body is distinctly shaped like a plump heart, with two rounded lobes at the top and a soft heart point forming a tiny ghost tail below. Happy dark plum star-shaped eyes, tiny sweet smile, pink rosy cheeks, tiny rounded arms.
Style/medium: polished 2D cartoon illustration, smooth dark plum outline, softly shaded cream and pink, cheerful romantic Halloween, no frightening details.
Composition/framing: entire ghost centered on a square canvas with generous clear margin, single isolated character, readable cute silhouette.
Scene/backdrop: genuinely transparent background with true alpha channel; all space outside the character fully transparent. Do not depict a checkerboard pattern.
Constraints: output exactly one sprite. No letter, envelope, other characters, text, watermark, scenery, floor, cast shadow, colored backdrop, or background elements. This sprite will float out of a pink animated love letter on a purple sky, but do not render the letter or sky.
```

## Imported artwork

The moon scenes use the cat extracted from the user-supplied `326387.mp4`, converted into a transparent animated WebP with a PNG alternative for reduced motion. Google’s Animated Noto Emoji ghost appears for “Boo!”, its bat joins the celebration, and its love letter and sparkling heart animate the finale (CC BY 4.0, with still SVG alternatives). The maze uses Google’s Alien Monster SVG (Apache 2.0), with the license and copyright notice included alongside it. All artwork is hosted locally. See `dist/assets/credits.html` for sources and modifications.
