# POLUS: Project Context & Handover

> Read this first. It holds everything needed to understand, run and keep building the Polus portfolio, including every decision made so far and the reasons behind them. It's written for a teammate **and** for an AI assistant (Claude) picking up the work.

---

## 1. What Polus is

Polus is a Cape Town studio that builds **websites and business systems**: lead capture, WhatsApp follow-up, automations. The positioning is deliberately not "we make websites". It's **"We make things move"**: we build the systems that turn attention into paying clients.

This site is the **portfolio** (more landing pages are planned separately). It's an interactive journey through space, not a normal scrolling site.

Name origin: *Polus* comes from the pole star, the fixed point sailors navigated by. The logo's "O" is a four-pointed star with a tilted orbit ring.

---

## 2. The experience, start to finish

1. **3D Earth intro (6 s).** A real-time three.js scene in black and white: Earth → fly to the North Pole → turn up the glowing white pole axis → shoot up the beam to the pole star. Plays automatically on **every visit**. Click, press a key, scroll or tap "Skip intro" to skip.
2. **The gate.** A black-and-white image of a statue seen from behind, pointing left at a galaxy. The big **POLUS wordmark** runs across the top, and the **statue stands in front of the letters** (a cut-out layer). A glowing **Enter star** sits at his fingertip, and floating particles drift toward it as the cursor approaches.
3. **The dive.** Clicking the star zooms the image and statue into it while a live starfield streaks out from that point. No video: it's all code, so there's no delay.
4. **Arrival.** "We make things move." with the subline and an "Explore Polus" button.
5. **The universe (main navigation).** Six code-drawn celestial objects, each a section:
   - **Orbit**: ringed planet. *What Polus is*
   - **Systems**: three orbits with signals travelling. *What we build*
   - **Worlds**: spiral galaxy. *Our work (portfolio)*
   - **Process**: binary stars. *How we work*
   - **Polus**: the pole star from the logo. *Who we are*
   - **Contact**: pulsar sending rings. *Start a project*
   Hover (desktop) or tap (phone): the object brightens, grows and a dashed targeting ring locks on. Clicking flies the camera into it and opens a side panel (full screen on phones).
6. **Worlds.** A second star map with one planet per client project. Clicking a planet flies in and opens the project page: details on the left, and a browser frame on the right showing a **full-length screenshot of the live site that scrolls itself** (it pauses when the visitor scrolls it).
7. **Contact.** A two-step form (project type → details) that **sends through WhatsApp** as a pre-written message, plus a "Book a call" link.

Always visible once inside: the **O symbol** (top-left, returns to the universe), **Start a project** (top-right) and a **WhatsApp** button (bottom-right).

---

## 3. Brand & design rules (agreed with the founder, don't break these)

- **Monochrome.** Black, white and greys only. The one exception is client screenshots on project pages, which stay in colour because they're the real work.
- **Minimal and uncluttered.** No busy photographic backgrounds behind text. Text must always be readable.
- **Top-left gets only the "O" symbol**, never the full POLUS wordmark.
- **The POLUS wordmark should be big** on the gate: as big as the layout allows.
- **Mobile first.** Around 90% of visitors will come from a phone (often via a WhatsApp link). Every change must be checked at about 390×844.
- **Asset quality is non-negotiable.** Never re-compress the founder's images or videos. Use originals as they are.
- **Smoothness matters.** No pauses between stages (the old transition video caused a visible delay and was removed for that reason).
- Fonts: **Instrument Serif** (display) and **Geist** (UI), from Google Fonts.

---

## 4. How to run it

The site must be served over **http**, not opened as a file, because the 3D intro is an ES module that browsers block on `file://`.

```bash
cd polus/site
python3 -m http.server 8000     # then open http://localhost:8000
```

Note: Python's built-in server doesn't support video "range" requests, which iPhones need for video. The site currently has no videos, so that's fine. A range-capable server script was used during development; any static host (Cloudflare Pages, Vercel, Netlify) handles this automatically.

To test on a phone: same Wi-Fi, open `http://<your-mac-ip>:8000`.

---

## 5. Folder structure

```
polus/
├── 01_BRAND/logo/            polus-symbol-white.svg, polus-symbol-black.svg (vector "O" star), wordmark PNG
├── 01_BRAND/reference/       original brand reference image (POLUS wordmark + statue + cosmic hand)
├── 02_HERO/                  original colour hero video, transition video, frame (NO LONGER USED on the site)
├── 03_UNIVERSE, 04_WORK...   original colour AI images (NO LONGER USED, kept as source)
├── POLUS_Minimalist_BW_Assets/   30 black-and-white AI images (source; mostly superseded by code-drawn art)
├── proto/                    the founder's original scroll-driven three.js Earth prototype (untouched)
├── assets/                   zip files of the original generated images
└── site/                     ← THE WEBSITE
    ├── index.html            everything: HTML, CSS and JS in one file
    └── assets/
        ├── intro/intro.js    3D Earth intro (converted from proto/main.js: time-driven, white beam)
        ├── intro/textures/   Earth day/night (4K + 8K) and clouds (4K)
        ├── bw/hero.jpg       gate image (black-and-white statue frame, 2752×1536)
        ├── bw/statue.png     statue cut-out layered IN FRONT of the wordmark
        ├── bw/og.jpg         link-preview image (figure holding a star)
        ├── bw/*              other B&W assets (mostly unused now: see §8)
        ├── img/work/site-1..3.jpg   full-page screenshots of the 3 client sites
        └── polus-symbol-white.svg   favicon
```

Only these files are actually used by the live page: `index.html`, `assets/intro/*`, `assets/bw/hero.jpg`, `assets/bw/statue.png`, `assets/bw/og.jpg`, `assets/img/work/site-*.jpg`, `assets/polus-symbol-white.svg`. Everything else is source or legacy material.

---

## 6. How `index.html` is organised

One file. Inside the `<script>` block, in order:

| Section | What it does |
|---|---|
| **POLUS settings** | `POLUS = { whatsapp, bookingUrl, email, socials }`. **Fill these in.** |
| **PROJECTS** | The client projects in Worlds: name, kind, what was built, problem/solution/result, live URL, screenshot, planet `look` (`ocean` / `gas` / `rock`). |
| **HAND / IMG_W / IMG_H** | Where the Enter star sits on the gate image (as fractions 0 to 1). Change these if the gate image changes. |
| **CODE-DRAWN ART (`ART`)** | Every celestial object is generated as SVG in code: `ART.orbit()`, `systems()`, `worlds()`, `process()`, `polus()`, `contact()`, `planet(look)`, and `ART.steps` icons. Sharp at any resolution; CSS animations (`.spin`, `.wobble`, `.pulse`, `.drift`). |
| **DESTS / WORLD_POS** | The six destinations and their positions: `d` = desktop %, `m` = mobile %. |
| **1. Intro + gate** | `coverPoint()` maps image coordinates to the screen; `placeWordmark()` sizes the wordmark (it only has to stay above his hand, `WM_BOTTOM`); `placeEnter()`; `showGate()`; floating "motes"; the click → dive. |
| **2. Space renderer** | Canvas starfield plus a **code-drawn galaxy band** (`makeBand()`: thousands of particles rendered once per scene at full pixel density). `flyTo()` animates the camera (zoom + streaks). |
| **3. Arrival + universe** | `renderNodes()`, `syncNodes()`, `arrive()`, `openUniverse()`. |
| **4. Panels** | Orbit, Systems (animated journey diagram), Process, Polus and Contact. The contact form builds a WhatsApp message. |
| **5. Worlds** | Enter Worlds, project pages, the self-scrolling screenshot (`autoScroll`). |
| **Startup (`boot()`)** | Runs **last** on purpose (see bug fix in §7). Loads the 3D intro with `import()`, with skip handlers and a 14 s safety fallback. |

State machine values: `intro → gate → warping → arrive → universe ↔ travel ↔ panel`, and `worlds ↔ project`.

---

## 7. Changelog (what was built and why, in order)

1. **Concept & structure.** Folder system (01_BRAND … 06_CONTACT) and the space-journey concept from a ChatGPT planning session.
2. **Logo.** The "O" star traced to a true vector SVG (potrace). The POLUS wordmark was traced from the brand reference, with the star SVG as the O.
3. **First prototype.** Colour hero video (10 s) → gate at the statue's fingertip → 2 s transition video → canvas universe with six destinations → panels → Worlds with sample projects → WhatsApp contact form.
4. **Videos compressed (then reverted).** The founder ruled that asset quality is non-negotiable, so originals are always used.
5. **30 colour AI images** wired in. Background removal: glowing objects via "un-multiply black" (alpha = brightness), planets keep a solid detected disc. The statue was cut out so the wordmark could sit behind his head.
6. **Real projects.** Green Point Tennis Club, Wedding Bells Suit Hire and Four & Twenty Café, each with a headless-Chrome full-page screenshot. The client sites block iframes (X-Frame-Options), so screenshots are used instead.
7. **Monochrome direction.** Everything moved to black and white. The founder's proto (3D Earth) replaced the hero video as the intro: time-driven, first 3.5 s, then 6 s at the founder's request, with the gold beam turned white.
8. **Transition video removed.** Replaced by the code "dive" (zoom into the star plus starfield streaks), which fixed the delay.
9. **30 B&W AI images** mapped to roles (by filename plus a visual similarity check) and vectorised. Later superseded, see 11.
10. **Gate image** switched to the founder's black-and-white statue frame. A new statue mask was built (smooth-texture detection plus a rim-light pass), so the wordmark sits behind his head at about 74% of the screen width.
11. **Declutter & quality pass (latest):**
    - All photographic backgrounds removed. Space is now drawn in code (galaxy band + starfield), sharp at any resolution, and text is always on dark space.
    - All six destinations, three planets and four step icons are **code-drawn animated SVG**. Section panels show their object instead of a photo, and project pages show the planet instead of a photo.
    - Hover/tap effects on objects (glow, scale, targeting ring).
    - 3D intro rendered in greyscale.
    - Phones: content fades under the fixed top bar, names stay on one line, and planet positions are tuned.
    - **Bug fix:** returning visitors got `Cannot access 'motes' before initialization` and the Enter star couldn't be clicked. The gate was shown before the rest of the script had run. Startup now runs last (`boot()`), and the intro plays every visit.

---

## 8. Assets that exist but aren't used (keep as source)

- `02_HERO/*`: colour hero video + transition video (replaced by the 3D intro and code dive).
- `site/assets/img/*` (except `work/`): colour images, their cut-outs and vectors.
- `site/assets/bw/*` (except `hero.jpg`, `statue.png`, `og.jpg`): B&W scenes, cut-outs and vectors, replaced by code-drawn art for clarity and sharpness.
- `site/assets/hero.mp4`, `transition.mp4`, `final-frame.jpg`: legacy.
- `_unused-compressed/`: compressed videos that were rejected.

These can be deleted from `site/` before deploying, to keep the upload small (only the files listed at the end of §5 are needed).

---

## 9. To do

**Content (founder):**
- [ ] WhatsApp number in `POLUS.whatsapp` (country code, no + or spaces, e.g. `27821234567`)
- [ ] Booking link in `POLUS.bookingUrl` (e.g. Calendly)
- [ ] Instagram/LinkedIn links in `POLUS.socials`
- [ ] The Polus story on the "Polus" panel (placeholder in brackets)
- [ ] For each project, the **problem** and **result** lines (highlighted placeholders in `PROJECTS`)

**Launch:**
- [ ] Domain (e.g. polus.co.za)
- [ ] Hosting: Cloudflare Pages recommended (free, fast in South Africa)
- [ ] GitHub: the repo `polus-site` isn't created yet. The founder removed the old "GarmentsArchive" GitHub login from the Mac; log in with the right account (`gh auth login`), then create and push.
- [ ] Delete unused assets from `site/` before upload (§8)
- [ ] Check on real phones (iPhone Safari + an Android) once live

**Nice to have:**
- [ ] Link-preview image: currently the "figure holding a star" image; could switch to the statue frame
- [ ] Load Earth textures faster on slow mobile connections (e.g. show the starfield while loading)
- [ ] Separate landing pages (planned, not part of this portfolio)

---

## 10. Notes for Claude (or any AI assistant) working on this

- **Everything is in `site/index.html`** except the 3D intro (`assets/intro/intro.js`). Make targeted edits, not rewrites.
- **Test on mobile (390×844) and desktop (1440×900)** after every change, and walk the whole flow: intro → gate → click star → arrival → Explore → a destination → Worlds → a project → contact form. Headless Chromium (Playwright) works well, **served over http**.
- The 3D intro needs WebGL; in headless tests it may fall back to the gate. That's expected.
- Keep **monochrome, minimal and readable**. Don't add photographic backgrounds behind text.
- Don't compress or re-encode the founder's assets.
- New celestial objects → add a function to `ART` (SVG, `viewBox="-100 -100 200 200"`, white on transparent), then reference it in `DESTS`.
- Animated SVG parts use `transform-box: view-box; transform-origin: 0 0` (the viewBox is centred on 0,0). Using `50% 50%` makes them rotate around the wrong point.
- Don't use `kind` for anything except the project subtitle (a field-name clash once overwrote it). The planet style is `look`.
- The gate image, statue cut-out, `HAND` and `WM_BOTTOM` belong together. If the gate image changes, all four need updating.

---

## 11. Mobile update (latest), and what's left

The founder loves the desktop version: **don't change desktop.** The latest work was phone-only.

**Done:**
- **Phone universe = scrollable, connected solar system.** At phone size (`body.m`, set in `renderNodes()`), the six destinations become full-width cards in a vertical list, joined by one dashed orbit line through the objects, each with a solid white "›" button. The list scrolls, and the top fades under the fixed bar. The desktop star map is unchanged.
- **Buttons you can't miss on phones:** solid white "Start a project" and WhatsApp buttons, a white "Explore Polus" pill, outlined pills for Back / Return / Enter / Skip. (All inside `@media (max-width:760px)`.)
- **Smoother (invisible on desktop):**
  - Space rendering pauses while a full-screen section covers it (project page everywhere, panels on phones).
  - The galaxy band uses a lighter pixel density (1.5) and 70% of the particles on phones.
  - Small stars are drawn as squares instead of circle paths.
  - `syncNodes()` only writes styles when the camera changes.
  - Artwork animations pause when hidden (closed panels, hidden node layers).
  - No `backdrop-filter` blur on phones (a solid background instead).
  - Gate particles 170 → 90 on phones.
  - 3D intro on phones: pixel ratio capped at 1.5 and a lighter Earth mesh (160×80 instead of 256×128).
- Gate images were **not** downsized: on a portrait phone the image is shown "cover", so it's displayed wider than 2752 device pixels, and smaller files would visibly lose quality.

**Still to do (performance):**
- [ ] Measure on a real phone (Chrome DevTools remote debugging or Safari Web Inspector) and with Lighthouse mobile; look for long frames.
- [ ] Consider turning off or halving the bloom pass (UnrealBloomPass) in the intro on phones if it still stutters. It makes the beam glow, so compare visually first.
- [ ] Consider 2K Earth textures for phones if the intro takes long to start on mobile data.
- [ ] Show the starfield (or a subtle loader) while the intro's textures load, instead of black.
- [ ] The Systems artwork uses SMIL `animateMotion`, which doesn't pause with CSS; pause it with `svg.pauseAnimations()` when hidden if needed.
