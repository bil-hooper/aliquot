# Aliquot — Project Plan

**A 3D navigable archive of a 13-year tribute-album project.**

Timeline: 22 Aug 2026 → 22 Dec 2026 (4 months, 8 two-week sprints + 1 launch week)
Scale: 800–2,000 cover recordings; audio already lives on Archive.org / Bandcamp
Existing data: current site / database (export or scrape path available)
Working URL: `aliquot.pages.dev` → `aliquot.org` once the name is locked

---

## 0. Naming — **Aliquot**

The word carries all four threads of this project at once, which is why it beat the alternatives:

| Sense | Meaning | Why it fits |
|---|---|---|
| **Aliquot stringing** | Strings in a piano that are never struck, sounding only by sympathetic resonance | Musicians arranged around a tone nobody plays. Not a metaphor — the mechanism. |
| **Aliquot stop** | An organ stop that adds harmonics *instead of* the primary pitch | The invisible sun, built into pipe organs since the Baroque. |
| **Genome aliquoting** | Reconstructing an ancestral genome from the genomes of its polyploid descendants | A formal description of what this site does. |
| **Aliquot part** | An exact divisor of a whole | What a harmonic is to a fundamental. |

**The thesis**, for the About page:

> At the center of Aliquot there is nothing. The orbits are held by a frequency no instrument in the system plays.

This is the *missing fundamental* — play only the harmonics of a note and the ear reconstructs a pitch that was never sounded. Its orbital twin: every ellipse has two foci, the sun sits at one, and Kepler's first law leaves the other permanently empty.

**Structural vocabulary** (keep consistent across repo, modules, shaders, and copy):

- The whole system → **the Aliquot**
- A concentric shell → an **orbit**
- The empty center → **the fundamental**
- A traversal between nodes → a **path**
- The derived band-to-band member links → **sympathetic** edges

**Naming caveat:** *aliquot* is a dense homonym — chemistry, number theory, US land survey, pharmacy. You will never rank first for the bare word. This is acceptable: visitors will arrive by name and by link, not by search.

**Rejected, with reasons worth remembering:** *Orrery* (good, but implies a sun at the center, which contradicts the thesis) · *Resonome* (best sound, but already used in consciousness research) · *Heliresonome* (unambiguous, but *helio* = sun, so it argues against its own premise) · *Aliquotic* (*aliquot* is already an adjective; the suffix reads as a typo) · *Phonotype* (real dictionary word with competing academic projects) · *Planets of Sound* (Pixies song title).

---

## 1. Architecture decisions (make these once, early)

These calls determine everything downstream. My recommendation is in **bold**, reasoning follows.

### 1.1 Static site, no runtime backend — **yes, with one narrow exception**

The entire graph is read-only and changes only when you rebuild it. So: a build-time ETL pipeline produces static JSON, and the browser loads it. No server, no database at runtime, no ongoing cost, nothing to patch or get hacked.

This is the single decision that makes "free hosting forever" achievable. The one deliberate exception is the contributor photo intake in §1.6 — a single small serverless Function, no database, no persistent process. It doesn't compromise the reasoning above; it's the narrowest possible carve-out for letting people submit content directly.

### 1.2 ETL in **C#**, frontend in TypeScript

You are fastest in C#. The ETL is a console app: hit APIs, normalize, reconcile, write JSON. There is zero benefit to writing it in JavaScript.

- **Staging store:** SQLite via `Microsoft.Data.Sqlite`. One file, versionable, queryable with DB Browser for SQLite while you work.
- **HTTP:** `HttpClient` + `Polly` for retry/rate-limit backoff.
- **Output:** `System.Text.Json` → sharded JSON into the web project's `public/data/`.

### 1.3 Renderer: **React + Vite + TypeScript + react-three-fiber**

- The 3D scene is maybe 40% of the work. The other 60% is panels: bios, photo galleries, audio embeds, search, the fallback destination list. That's React's job.
- react-three-fiber (R3F) + `@react-three/drei` gives you the React ergonomics with imperative escape hatches for the performance-critical parts.
- If R3F's abstraction fights you during the Sprint 2 spike, fall back to vanilla Three.js with a React UI layer beside it. Decide by end of Sprint 2, not later.

### 1.4 Hosting: **Cloudflare Pages**

| Host | Free tier | Verdict |
|---|---|---|
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/mo, 25 MB/file | **Pick this.** Unlimited bandwidth matters if this gets shared around music forums. |
| GitHub Pages | 1 GB repo, ~100 GB/mo soft cap | Fine backup. Bandwidth cap is a "please stop" email, not a hard limit. |
| Netlify | 100 GB/mo | Good, but capped. |
| Vercel | 100 GB/mo hobby | Good, but hobby tier forbids some commercial use. |

- Repo on **GitHub** (free, private or public).
- Image overflow, if the repo gets fat: **Cloudflare R2** — 10 GB storage free, zero egress fees.

### 1.4b Domain strategy — **defer the purchase, not the launch**

Nothing in the build depends on the hostname. Attaching a custom domain to Cloudflare Pages is a five-minute DNS change, so the naming decision must never block a sprint.

| Stage | URL | Cost | When |
|---|---|---|---|
| **Build & test** | `aliquot.pages.dev` | Free, instant, no approval | Sprint 1, day one |
| **Launch** | `aliquot.org` | ~$11/yr | Buy once the name is final (target: Sprint 5) |
| Free fallback | `aliquot.eu.org` | Free, ~14-day approval | Only if you decide against paying |

**Registrar warning:** headline first-year .org prices are frequently loss-leaders — one major registrar advertises $5.00 first year and renews at $37.99. Ignore first-year pricing entirely and compare *renewal* rates, which bottom out around $10–11. Cloudflare Registrar sells at wholesale cost with no first-year gimmick, which is the right shape of deal for something meant to outlive the project.

**Free options considered and rejected:** `*.js.org` (now restricted to projects with a direct relation to the JavaScript ecosystem — an archive site would likely be declined) · `*.is-a.dev`, `*.is-an.app`, `*.js.cool` (jokey register, wrong for a memorial) · `*.github.io` (requires the *username* to be "aliquot", otherwise you get a path-suffixed URL).

**Deferred: `aliquot.fm`.** Thematically ideal — radio, and *forum member* in this community's own shorthand. But .fm registration runs ~$68 with renewals of ~$74–89/year, and short dictionary words are often flagged as premium and priced higher still. That's roughly $700–900 over ten years against $110–130 for .org. **Decision: not now.** Revisit after launch if the site finds an audience. The pun survives without it — see §6 note on the FM bio field.

### 1.5 Audio: **embed, never host**

Everything stays on Archive.org and Bandcamp. You embed. This means:
- No storage cost, no bandwidth cost.
- No copyright exposure — the hosting platforms already carry that.
- The play counts stay with the project's real pages, which is the right tribute.

Archive.org has a clean, documented embed. Bandcamp is trickier — see Risk R1.

This is the *live* posture, and it doesn't change. §1.9 adds a quiet backup underneath it, in case it ever has to.

### 1.6 Claiming a page: **admin-verified, not self-serve**

Zach's read is that letting anyone self-serve their way into editing a band's or member's page is optimistic, and he's right to be skeptical of it — impersonation on a memorial site is a real cost, not an abstract one. This replaces the original self-serve design with a slower, human-gated one. Most of the underlying machinery survives; what changes is *who* gets a token and *when*.

**Every `Person` and `Artist` carries a `contact_email`, null by default, settable only by you.**

```
contact_email: string | null   // set only by you or another admin, by hand
claim_status: "unclaimed" | "claimed"
```

This is the same discipline already established for `manual_overrides` in §8 — a value only you write, never touched by any automated sync, never inferred.

**The claim flow, end to end:**

1. **Unclaimed landing page shows one button: "Claim this page."** No form, no infrastructure — it's a `mailto:` link addressed to you, pre-filled with the entity's name and id, so the request already tells you which page it's about. Zero moving parts, which matches how rarely this actually fires (dozens to low hundreds of requests across the whole project's history, not a stream).
2. **You verify, by whatever judgment you'd use anyway** — cross-referencing against Bandcamp credits, the forum, however you'd recognize a real request from a stranger's guess. This step is deliberately outside the system. No amount of engineering replaces you actually knowing your own community.
3. **You set `contact_email` by hand**, then generate that person's token using the same stateless HMAC mechanism as before — `HMAC-SHA256(shared_secret, person_id + issued_date)` — now issued **on demand, one at a time**, not in a Sprint 3 bulk batch. This runs through the local admin app (§1.7c), which writes the email and token to Airtable and shows you the URL to paste into your reply — seconds, not a separate tool to context-switch into.
4. **You send the claim link back in your own reply to their request.** No automated email-sending needed for this step — you were already writing back to verify them, so the link rides along in the same message.
5. From there, the claim page and everything on it works exactly as originally designed: file picker for a photo, the consent checkbox, `display_preference`.

**What this buys you over the original design:** the original model verified identity *once*, at the moment a bulk mailing went out, and then trusted the token forever after. This model re-anchors trust in something you actually checked — the token doesn't exist until you've looked at the request and decided it's real. A leaked or forwarded link is still a risk (same as before), but a *guessed* one no longer gets anyone anywhere, because there's no mailing list of pre-issued tokens sitting around to leak from.

**Two categories of image, two different rules — unchanged from before:**

| Source | Storage | Why |
|---|---|---|
| Contributor-submitted photos | **R2, you host it** | You have consent; you're the rightful custodian. |
| Wikimedia Commons | **Hotlink, don't copy** | Free to copy with attribution, but hotlinking their CDN costs you zero storage and zero risk. |
| Discogs | **Hotlink only, never copy** | Not redistributable at all (§4, Risk R5). |
| Cover Art Archive | **Hotlink** | Keyed to MusicBrainz IDs, meant to be linked. |

**The upload endpoint is a Cloudflare Pages Function**, JS/TS since Workers doesn't run C#. It verifies the HMAC signature and expiry, checks file type and size, and writes to a **private** bucket under `pending/{person_id}/{timestamp}-{filename}` — no resizing here, Workers' free plan caps CPU at <cite index="81-1">10 ms per invocation,</cite> nowhere near enough to decode an image. That work stays batch-style in the C# pipeline, same as always.

**Moderation gate, unchanged:** during each data-refresh, you review `pending/`, approved files get processed into the **public** `aliquot-media` bucket, rejects get deleted. Nothing reaches the public bucket without you looking at it — this was already true, and the admin-gated issuance above just adds a second layer in front of it, not a replacement for it.

### 1.7 Once claimed: **what they can edit, and where the line sits**

Bio and links work exactly as designed before — same claim page, same "your links" panel, same KV storage, same automated validation, same once-daily-at-most sync (detailed below, tightened from the original "nightly or a few times a week"):

```
KV["entity:{id}"] = {
  bio,
  links: [ { url, label? } ],   // capped at 8
  members: [ { person_id, role?, from_date?, to_date? } ],  // new — see below
  display_preference,
  updated_at,
  submission_count
}
```

**New scope: current and past members, linking to other nodes.** This is a genuinely different kind of edit from bio text — it touches graph structure (`MEMBER_OF` edges), not just leaf content, so it gets its own rule:

- **The edit form only lets someone reference an *existing* Person node** — a searchable picker by name or handle, not a free-text field. Selecting someone and marking them current or past member (with an optional date range) is exactly as automated as a link edit: validated by rule, synced on the next build, no review needed, because the person being referenced already exists and already went through whatever scrutiny got them into the system in the first place.
- **If the person they want to add isn't in the system yet, there's no self-serve path to create one.** A "suggest a new member" option submits a request that lands in the *same admin queue as claim requests* — reusing infrastructure rather than building a second review system — and you decide whether to add them. This is the one place self-editing still routes through you, deliberately: letting a claim-page form silently instantiate new people into the graph is exactly the kind of "optimistic" surface Zach flagged, and it's cheap to close off.

**Rebuild cadence: at most once a day, by design, not by convention.** Everything above — approving a claim, moderating a photo, a band editing their own bio — writes only to KV, R2, or your local SQLite corpus. None of it touches git. **Exactly one thing is allowed to commit and push: a single scheduled job, once daily.** That's the only door to a deploy, so the rebuild frequency is architecturally bounded, not just usually-low — you can approve five claims and moderate a dozen photos in one afternoon and it's still zero deploys until that night's run.

That job:
1. Pulls the day's KV changes and any newly-approved R2 photos.
2. Regenerates the JSON.
3. **Runs a sanity check before touching git at all** — does the output parse, is the node count in a plausible range, did anything drop to zero that shouldn't have. Fails the job and skips the push entirely if something looks wrong, rather than shipping a bad regeneration and finding out from the live site.
4. Commits and pushes **only if there's an actual diff** — a quiet day means zero deploys, never a forced empty one.

`workflow_dispatch` stays available, but reframed: it's not a way to sneak in extra runs, it's you deliberately choosing to deploy sooner than tonight for something that genuinely can't wait. Still one decision, still yours.

**If a build ever does fail**, Cloudflare Pages doesn't take the live site down over it — a failed deployment simply doesn't replace the last successful one, so the worst case is "today's edits aren't live yet," never "the site is broken." Worth knowing so the once-a-day cadence reads as a deliberate choice rather than a risk you're accepting.

Everything else from the original §1.7 stands as designed: URL scheme/length validation at the Function, dead-link checks deferred to build time, the `contributor_submissions` table kept separate from `manual_overrides` so a sync never clobbers your own hand edits.

**Contact-me (§1.7b) sits outside all of this entirely** — a relayed message isn't a change to the site's published data, so it never touches KV in a way that feeds the sync job, never triggers anything, and has nothing to do with the once-a-day cadence above.

### 1.7b Contact me: **reaching someone without ever seeing their address**

This is new — a way for site visitors to message a claimed band or member without their email appearing anywhere on the page or in the page source.

**Only claimed pages get a "Contact" button** — there's no `contact_email` to relay to before that, so this one falls out of the data model for free rather than needing its own separate gate.

**The flow:** visitor fills a short form — their message, and their *own* return address so a reply is possible — submitted to a Pages Function, which relays it by email to the entity's `contact_email`. The recipient's address never reaches the visitor's browser at any point; the sender's does reach the recipient, since without it there's no way to reply, and building a full in-site two-way messaging system is well past what this needs.

**This is the one place the plan now needs an actual email-sending service** — everywhere else, you're the one sending mail by hand. <cite index="27-1">Resend's free tier covers 3,000 emails a month at 100 a day,</cite> which a niche tribute site's contact volume won't come close to, and <cite index="27-1">it's a genuinely permanent free tier, not a trial.</cite>

**Rate limit, exactly as specified:** one message per IP address per day, site-wide. A Workers KV key per (hashed) IP with a 24-hour TTL — hashed rather than stored raw as a small privacy courtesy, since there's no reason to keep an identifiable IP around longer than the rate-limit window needs. If the key exists, the Function rejects the submission; if not, it sends and sets the key. This won't stop someone determined enough to rotate IPs — worth saying plainly rather than implying the limit is airtight — but it stops casual spam at negligible cost, which is the actual bar for a site this size.

### 1.7c The admin app: **local, not hosted — Airtable is the only server-side piece**

Every admin action from §1.6 and §1.7 — issuing a claim token, reviewing a photo, setting a contact email — now runs through one C# app on your own machine, not a hosted tool anyone else could reach.

**App shape:** a menu-driven console app, not a full GUI — it matches the ETL tool you're already building, and "I don't need a complex system" cuts toward simplicity here too. Photo review doesn't need an embedded image viewer; the app can just shell out to whatever Windows already opens images with (`Process.Start` on the file path) and ask approve or reject. A WPF version is a reasonable later upgrade if the console ever feels limiting — not a day-one requirement.

**Login:** email and password, checked against a row in an Airtable "Credentials" base. The row also carries the role — `moderator` or `admin`, nothing more granular, matching what you asked for.

**Password hashing, done properly even for an internal tool:** `BCrypt.Net-Next` from NuGet — a standalone, well-vetted bcrypt implementation that doesn't drag in any ASP.NET dependencies for what's a console app, not a web app. Store only the hash in Airtable, never the password itself.

**Two roles, one sensible default split** (yours to adjust — you didn't specify further, so this is a starting point, not a ruling):

| Role | Can do |
|---|---|
| **Moderator** | Process claim requests, review/approve/reject photos, day-to-day operational work |
| **Admin** | Everything a moderator can, plus manage credentials themselves — add a moderator, reset a password, touch the Airtable schema |

**Forgotten password, exactly as you framed it:** there's no self-serve reset flow. If it's *you*, you already have direct Airtable access and can fix your own row by hand — that's the "can't be locked out" property working as intended. If it's ever a second moderator, an admin-role menu option in the app recomputes a hash and writes it to their row — no external tooling, no manually pasting bcrypt output.

**The app handles workflows with side effects; Airtable's own UI handles ad hoc edits directly.** The app doesn't need to reimplement a data browser for every field — fixing a typo'd email or nudging a role is a cell edit in Airtable itself, exactly as you described ("manual" access). The app's job is specifically the actions that touch something *beyond* Airtable: issuing a token and showing you the URL to paste into your reply email, moving an approved photo from the private bucket to the public one, optionally kicking off the GitHub Actions sync early via GitHub's API instead of the website — the things a spreadsheet cell can't do by itself.

**Tokens stay stateless — this doesn't change.** Airtable is where you look at and edit what's been issued; it is not something the live Cloudflare Function queries when a visitor opens a claim link. Verification is still just an HMAC signature check against the shared secret, exactly as designed in §1.6 — an Airtable outage would only ever delay *you* processing a request, never break the live site for a visitor.

**`contact_email`'s path to the public site stays the once-daily sync from §1.7.** That job now also reads current `contact_email` presence from Airtable's API and folds it into the same public-safe `claimed: true/false` flag — same day-behind lag already established, no new dependency added to anything visitor-facing.

**Local secrets — Airtable API key, the HMAC shared secret, and a GitHub token if you wire up the sync-trigger — live in a gitignored local config on your machine,** never in the public repo. .NET's User Secrets or a local `appsettings.Local.json` both work; either is fine as long as it never gets committed.

**Cost and limits:** <cite index="146-1">Airtable's free plan is permanent, not a trial — 1,000 records per base, unlimited bases, 5 editors.</cite> A credentials table is nothing — you and however many moderators you ever add. Watch it if entity-level tokens and emails end up as one row per claimed band or person instead of just credentials — hundreds of claims could approach that ceiling, and <cite index="144-1">the 5-requests-per-second API rate limit is a hard cap on every tier, including paid ones.</cite> Splitting credentials and entity data into separate bases sidesteps this entirely if it's ever a real concern; worth deciding the base structure up front rather than migrating later.

### 1.8 Landing-spot URLs: **your Aliquot tag**

Worth splitting into two layers, because they answer two different needs and cost very different amounts:

| Layer | What it is | Cost |
|---|---|---|
| **1 — Universal** | Every node, of every type, gets a working URL for free — `/n/{id}`, a raw passthrough of the id it already has. | Near zero. No slug logic, no collisions to resolve. |
| **2 — The tag** | A pretty, human-chosen alternative address on top of Layer 1 — `@handle`, `/artist/nightshade` — worth sharing in a bio elsewhere. | Real, but bounded design work (below). |

This is the resolution to "less important for the covered artists, but keep it consistent": **Layer 1 is trivially consistent across every type at no extra cost**, since it's just URL-passthrough of an id every node already has. Layer 2 — the actual "tag" — is worth prioritizing for people and covering bands, who'll actually go share one, and can extend to original artists later for free, since it's the identical code path. Nothing forces you to build the nice version for a shell nobody's advertising yet.

**Route shape mirrors the orbital hierarchy — nested where there's real ownership, flat where there isn't:**

| Route | Entity | Why this shape |
|---|---|---|
| `/@{handle}` | Person | Flat — a person belongs to *multiple* bands, so nesting under any one of them would be wrong. |
| `/artist/{slug}` | Artist — covering or original | One prefix for both roles, since `Artist` is already a single unified type (§2.1) carrying a role flag, not two separate types. Free for both once built once. |
| `/artist/{slug}/song/{song-slug}` | Recording | Nested — a specific recording genuinely belongs to one performing artist. |
| `/artist/{slug}/album/{album-slug}` | Release, when it belongs to one artist | Same reasoning — an original LP or a covering band's own album. |
| `/album/{comp-slug}` | Release, when it's a tribute compilation | Flat — a comp like *Vol. 9* isn't owned by any single artist, so it doesn't nest under one. |

**This is bidirectional, not just entry points.** Whatever node you're focused on in the live scene — arrived at by clicking, by the destination list, by search — the address bar updates to that node's canonical URL via `history.pushState`, no full reload. That's what makes "a URL that goes to their landing spot" true in general, not just for pre-built links: anyone exploring can copy whatever's in the bar and it's the exact spot they found. Given the app is functionally one canvas with a changing focus rather than genuinely separate pages, plain `pushState` and a small path parser does this more simply than pulling in a full router library — no need for React Router here.

**Slug generation must be sticky, or the whole point breaks.** Slugs are assigned once per entity and **persisted**, never recomputed fresh on every rebuild. If they were recomputed each time, an unrelated catalog addition could shift collision order and quietly reassign someone's `-2` suffix to a different band — which would break every link anyone had already shared. Concretely: derive the slug (from current handle, band name, or song title), check it against already-assigned slugs, append a stable numeric suffix on collision, store it, done. Regenerating the site later never touches an existing entity's slug.

**Old handles keep working.** `Person.handles[]` (§2.1b) already tracks a full history — extend that into `slug_history[]`, so a URL built from someone's 2016 handle still resolves and redirects to their current one, rather than 404ing because they changed their name in 2018.

**Broken or stale link:** land on the same destination-list/search panel from Sprint 6, with a plain note — *"that page has moved or doesn't exist — search for it here"* — never a blank error.

**Where slugs are generated:** Person and covering-Artist slugs during Sprint 3's roster resolution — independent of `claim_token`, which is no longer generated in bulk at all (§1.6 issues it on demand, one at a time, as claim requests are approved). Original-artist, Recording, and Release slugs in Sprint 4, once the cover→original catalog is actually resolved.

**Cost: effectively nothing.** This is client-side routing plus a small `slugs.json` lookup table (id ↔ slug, a few hundred KB at most) shipped alongside the existing `skeleton.json` — no new backend, no new hosting line item.

**In the product copy, use their own word for it:** the claim page can read *"Your Aliquot tag: `@tapehiss`"* — it's the term they reached for, and it lands better than "your URL."

### 1.9 Audio resilience: **quiet backup, embed live**

The goal isn't to change how audio is served today — §1.5 stands. It's to make sure that *if Bandcamp ever disappears — or if a better option shows up, or a second one is worth having ready* — switching over is a data flip and a redeploy, not a rebuild of the audio system from scratch to accommodate whatever's next.

**"Save the heartache" means the abstraction has to be open-ended, not a fixed three-way choice.** A closed `type: "bandcamp" | "archive_org" | "r2"` union would mean touching the schema, the dispatcher, and every existing row the day you wanted to add YouTube, or SoundCloud, or something that doesn't exist yet. So instead of a fixed enum, this is a **provider registry**: one active source per recording, plus a list of whatever backups are on hand, both referencing an open provider name rather than a closed type.

```
Recording {
  ...
  audio_source:  { provider, ref },              // the one actually rendered
  audio_backups: [ { provider, ref, verified } ]  // ready to promote, not rendered
}
```

**The registry pattern, mirrored on both sides of the stack:**

- **Renderer (TS):** a single lookup object, `AUDIO_PROVIDERS: Record<string, (ref) => Player>` — `bandcamp`, `archive_org`, `r2` today. The dispatcher component is one line: `AUDIO_PROVIDERS[recording.audio_source.provider](ref)`. Adding `youtube` later is one new entry in that object — nothing else in the component tree changes, and nothing about existing recordings needs to change either.
- **ETL (C#):** the mirror image — a small dictionary of harvesters, one per provider, each knowing how to fetch and validate that provider's own ref format (a Bandcamp track ID, an Archive.org identifier, an 11-character YouTube video ID). Adding a provider means registering one new harvester, not editing the others.

This is the actual mechanism behind "architecture on day one, backfill whenever" — the registry is what's built early; population of any given provider's data can lag indefinitely behind without the code caring.

**Two backup tiers, not mutually exclusive:**

| Tier | What it is | Trade-off |
|---|---|---|
| **R2, private** (as before) | A bucket only you control | Total control, but the exposure at failover-time is entirely yours to carry. |
| **Archive.org, your own item** | Upload the original masters as your own Archive.org item — free, no billing, explicitly built for exactly this kind of preservation use | Mission-aligned and genuinely free, but still a third party — the same category of risk Bandcamp itself carries, just a different, more archive-minded one. |

Using both isn't redundant, it's actually the point: R2 is the copy nothing but you can take away; an Archive.org item is a copy that's independently discoverable even if `aliquot.org` itself ever goes dark too. Either one — or both — plugs into the same `audio_backups[]` list and the same dispatcher with zero additional plumbing.

**YouTube is available in the registry, with a caveat worth stating plainly.** A YouTube embed is stable and well-documented, but uploading *cover* recordings there — as opposed to just linking to something already posted by someone else — exposes them to ContentID matching against the original song's rightsholder, which can mute, monetize-against-you, or take down the upload, independent of whatever standing this project already has. That makes YouTube a reasonable *option* in the registry, but not the first one to reach for as backup specifically — see Risk R11.

**Timeline, in your own framing:** the registry pattern — the actual architecture — belongs in Sprint 5, alongside the rest of the audio work; that's "day one" for this subsystem, not literally August 24th. Populating any given backup tier — harvesting to R2, uploading masters to Archive.org — can lag well behind that, exactly as you said: worth noting, **day 100 of this plan lands on December 2nd, almost exactly inside Sprint 8.** That's a genuinely reasonable real target for an Archive.org backfill pass, not just a round number.

**Failover, when and if it's ever needed:** pick the best entry from `audio_backups[]`, promote it to `audio_source` — a script across the affected rows, not 2,000 manual edits — regenerate JSON, redeploy. No player code changes, because the dispatcher already handles whatever provider was chosen.

**Keeping a private copy is not the same decision as serving one publicly** — the copyright reasoning in §1.5 was specifically about *live* distribution; an unpublished backup is closer to ordinary preservation than to redistribution, and the exposure only changes at the moment you'd actually promote a backup and make it live — which is precisely the moment the alternative is the tribute disappearing outright. Said plainly so you can weigh it yourself, not as a ruling.

**Archive.org and Bandcamp are not equally easy to back up, and the plan should say so rather than pretend otherwise:**

| Source | Backup difficulty | Approach |
|---|---|---|
| **Archive.org** | Easy | Their API serves direct file downloads by design — this is normal, expected use of the platform, not scraping. |
| **Bandcamp** | Uncertain | The embed player streams through Bandcamp's own delivery, not a clean downloadable file — getting bytes out isn't guaranteed just because embedding is. This needs its own answer, separate from the embed-ID question already in Risk R1. |

**The best fix for the Bandcamp gap may not be technical at all.** Whoever built each compilation almost certainly received the original submitted files from every covering band directly, over thirteen years — that's very likely a cleaner, higher-quality backup source than anything scraped from a streaming player, and it's also exactly what you'd upload to Archive.org as your own item if you go that route. Worth adding to the founder outreach: not just "can I use your metadata," but "do you still have the original masters." One extra line in a letter you're already sending.

**This is insurance, not launch-blocking scope.** The site fully works, and always has, on embeds alone. Populating any backup tier can run quietly in the background across several sprints without ever threatening Milestone M5 — see the cut ladder if it needs to slip.

---

## 2. Data model

Five node types, one graph. Everything you described falls out of this.

### 2.1 Nodes

| Type | Description | Example |
|---|---|---|
| `Person` | A human. Musician, engineer, producer, artwork. | a bassist in a covering band |
| `Artist` | A band or performing act. Covering **and** original. | the band being covered; the band covering them |
| `Release` | An album/EP/comp. Cover **and** original. | Vol. 9 of the tribute series; the original LP |
| `Recording` | A specific audio performance. | the cover version; the original version |
| `Work` | The abstract song, independent of any recording. | the composition itself |

**Key idea:** `Work` is what links a cover to its original. Cover `Recording` → `Work` ← original `Recording`. This is exactly how MusicBrainz models it, so the data maps directly.

An `Artist` carries a flag: `covering`, `original`, or **both** (this will happen more than you expect — people in the tribute scene get covered too, and original artists sometimes contribute).

**Every node type carries `slug` and `slug_history[]`** (§1.8) — the human-readable half of its URL, alongside the raw `id` every node already has for Layer 1 routing. Assigned once at build time, persisted, never silently regenerated.

**`Recording` additionally carries `audio_source: { provider, ref }` and `audio_backups: [{ provider, ref, verified }]`** (§1.9) — `provider` is an open name (`"bandcamp"`, `"archive_org"`, `"r2"`, `"youtube"`, or any future addition), not a fixed set baked into the schema. This is what lets the embed dispatcher render the right player, and what lets a new provider get added without touching existing recordings.

### 2.1b `Person` identity — handles are a first-class field

Contributors to this project are known to each other primarily by **forum handle**, not legal name. That single fact changes three things.

```
Person {
  id
  slug                   // canonical, e.g. "tapehiss" → routes as /@tapehiss (§1.8)
  slug_history: []       // old handle-derived slugs, still resolve and redirect
  legal_name?           // may be absent, and that is fine
  handles: [             // plural and ordered — 13 years means people renamed themselves
    { handle, from_date?, to_date?, source }
  ]
  display_preference    // "name" | "handle" | "both"
  bio, photos[], links[]
  contact_email          // lives in Airtable, not here — null until you set it by hand, §1.7c
  claim_status           // "unclaimed" | "claimed"
  claim_token             // lives in Airtable too — null until issued on demand, §1.7c
  photo_status           // "none" | "pending" | "approved"
}
```

The same `Artist` type (covering bands) carries the same fields — `contact_email`, `claim_status`, `claim_token`, `photo_status` — since the claim flow in §1.6 applies to both people and covering-band landing spots identically. `bio`, `links[]`, and `members[]` on both types are sourced from the automated §1.7 path once a claimed entity has submitted; until then they fall back to whatever you imported yourself.

**`contact_email` and `claim_token` live in Airtable, never in the public JSON — this is what makes the once-a-day cadence (§1.7) fine for claim status too.** The site's build output only ever gets a public-safe `claimed: true/false`, pulled from Airtable during the nightly sync and derived from whether an email is on file — never the address itself. That means the "Contact" button appearing is naturally allowed to lag up to a day behind you actually approving a claim in the admin app (§1.7c) — there's no reason it would need to be faster, since the underlying value it depends on was never meant to be public in real time, or at all.

**1. Handle is the primary deduplication key.** This inverts the original design. Two `Dave Smith` credits are unresolvable from names alone; `@revox_a77` and `@tapehiss` are trivially distinct. Legal name drops to a secondary signal. This substantially defuses Risk R3.

**2. Handles are plural and dated.** Over thirteen years people rename themselves. Store each handle with a date range and where you found it. The handle history is archival content in its own right — *"posted as revox_a77 until 2018, then tapehiss"* — and it's the only way to correctly attribute a 2014 credit to a person you now know under a different name.

**3. `display_preference` is the consent mechanism.** Some contributors will want handle-only credit. Making that a schema field rather than an opt-out email turns Risk R7 from a liability into a feature: you are asking how someone wishes to be known, not asking permission to expose them.

### 2.2 Edges

| Edge | From → To | Carries |
|---|---|---|
| `MEMBER_OF` | Person → Artist | role, date range |
| `PERFORMED_ON` | Person → Recording | instrument/role |
| `CREDITED_ON` | Person → Release | engineer, artwork, producer, liner notes |
| `RELEASED` | Artist → Release | — |
| `APPEARS_ON` | Recording → Release | track number, disc |
| `PERFORMANCE_OF` | Recording → Work | is_cover: bool |
| `WROTE` | Person → Work | composer, lyricist |
| `FEATURES` | Release → Artist (original) | *(a cover-series volume's dedicated original artist)* |
| `SELECTED_BY` | Release → Artist (covering) | *(the covering artist whose turn it was to choose)* |

**`FEATURES` and `SELECTED_BY` are both optional, per volume, on purpose.** The tribute series ran on a pattern — the group voted, and the covering artist who won got to pick the next original artist — but not every volume necessarily followed it, and not every volume will have a clean record either way. Neither edge should ever be guessed at or backfilled from adjacent volumes; where the record is missing, the field is simply absent, not empty or wrong. This is unlikely to be in MusicBrainz or Discogs — it's project history, most likely findable in the existing site's own records or forum. **That's currently outside scope** — Zach's blessing covers Bandcamp metadata specifically (Sprint 2), not a forum or site export — so treat this edge as blocked until that's a separate ask, not something to source quietly alongside the Bandcamp pull.

**Both directions are already walkable, for free.** A volume's landing spot can show *"Selected by: [covering artist]"*; that covering artist's own landing spot can just as naturally show *"Selected the original artist for Vol. 9"* — no second edge needed, since every edge in the graph is traversable either way by construction (that's the whole premise of the site). Worth surfacing on the covering artist's side too — it's a real distinction for a band to have earned, and the data supports showing it without extra modeling.

**Derived at build time, never stored by hand:**
- `SHARES_MEMBER` (Artist ↔ Artist) — computed from `MEMBER_OF` overlap. This is your "bands with a member in common" layer.
- `COVERS` (Recording → Recording) — computed by walking cover→Work→original.

### 2.3 Orbital shell assignment

Center outward, matching your description:

| Shell | Contents | Visual |
|---|---|---|
| **0 — Core** | The tribute project itself | The fundamental. Present, but unlit — see §0. |
| **1** | Covering-band **members** | Innermost shell. Bio, photo, links. |
| **2** | **Covering bands** | Bright shell. Bio, photo, non-tribute discography links. |
| **2a** *(sub-orbit)* | Cover **recordings**, clustered around their band | Small satellites. Audio embed. |
| **2b** *(sub-orbit)* | Cover **releases** (the comps) | Larger satellites, shared. |
| **3** | **Original artists** being covered | Shell. |
| **3a** *(sub)* | Original **releases** | Satellites of their artist. |
| **3b** *(sub)* | Original **recordings** | Satellites of their release. |
| **4 — Faint outer** | Original-record **personnel** — players, engineers, artwork | Dim, low-opacity, off by default. |

**Geometry: full spherical shells, not flat disks.** Each orbital shell is a hollow sphere at its own radius — nodes distributed across the whole 3D surface, not confined to a thin ring. This gives every shell dramatically more room as the catalog grows into the hundreds or thousands of nodes it's headed for, and it's a genuinely better fit for "shell" as a word — electron shells in an atom are true spheres, not disks; the flat-ring version only ever borrowed its look from the orrery name, which didn't survive to become the actual name (§0).

**Radius still means exactly what it did before — that part was never disk-specific.** A sphere at radius 15 is exactly as unambiguously "shell 2" as a ring at radius 15 was. What changes is only how nodes are arranged *within* a shell — a 3D surface position instead of a 1D angle — not which shell a node belongs to.

**The one real trade-off, stated plainly: depth is harder to read than angle.** A tilted disk viewed from a fixed angle gives an instant "concentric rings" read, the way Saturn does. A full sphere leans more on distance-from-center, and human depth perception without stereo cues is genuinely worse at that than at reading angular position. Two mitigations, both already in the plan rather than new: shell color-coding (§3.2) does the disambiguating that radius alone can't always manage from a bad angle, and the default camera framing on load can still favor a somewhat oblique, overhead-leaning view — close to how the disk version would have looked — so the first impression stays legible and the fuller volume reveals itself as a visitor actually explores.

---

## 3. The two hard technical problems

Naming these now so they don't ambush you in month three.

### 3.1 Angular ordering (the anti-spaghetti problem)

You correctly predicted "packed with lines, potentially confusing." The fix isn't only hiding edges — it's **where you place nodes on their shell**.

If band positions on Shell 2 are random, every edge to Shell 1 and Shell 3 crosses the whole space. If connected nodes are placed near each other, edges become short spokes and the picture reads instantly. That part of the problem is unchanged by the move to full spheres in §2.3 — what changes is the last step of how the solution gets applied.

**Solve the ordering as the same 1D problem it's always been; only the final placement step becomes spherical.** True 2D crossing-minimization directly on a sphere surface is a substantially harder, more research-shaped problem than this project needs to take on in four months. Instead, reuse the existing barycenter approach to produce an *ordering* — unchanged — and only change what that ordering gets mapped onto:

1. Order Shell 3 (original artists) alphabetically, or by first-covered date. Fixed reference.
2. For each Shell 2 band, compute the **circular mean** of the (still one-dimensional) position of the original artists it covered.
3. Sort Shell 2 bands by that value. This produces a rank, 0 to N−1 — not yet a position in space.
4. Repeat for Shell 1 people against Shell 2 bands.
5. Iterate 3–5 passes (barycenter heuristic). Converges fast, gets ~80% of the way to optimal — same as before.
6. **New last step:** map each shell's final ranking onto a Fibonacci sphere (golden-angle spiral distribution across that shell's radius) instead of onto a flat circle. Consecutive ranks land near each other on the sphere's surface, since the spiral preserves index-adjacency reasonably well — not a perfect 2D layout, but a good practical approximation that ships in the same timeframe as the original approach, because steps 1–5 didn't have to change at all.

Do this **at build time in C#**, bake the 3D positions into the JSON. The browser never computes layout.

### 3.2 Rendering ~15,000 nodes and ~50,000 edges at 60fps

Rough node estimate at your scale: 1–2k cover recordings, ~30 comps, 400–800 covering bands, 800–1,500 covering musicians, 300–800 original artists, 1–2k original recordings + releases, and potentially 2–5k original personnel. Call it **8,000–15,000 nodes, 30,000–60,000 edges.**

Individual `Mesh` objects will not work. Required techniques:

- **`InstancedMesh`** for all nodes of a shell — one draw call per shell, per-instance color and scale via instance attributes.
- **Single `LineSegments`** buffer for all edges, with vertex colors. Update opacity via a color attribute, not by rebuilding geometry.
- **GPU picking** for hover/click: render instance IDs as colors to an offscreen 1×1 render target at the cursor. Raycasting 15k instances every frame is not viable; GPU picking is O(1).
- **Edges hidden by default.** Only the focused node's edges render at full opacity; 1-hop neighbors at ~30%; everything else off. This is a design decision as much as a performance one.
- **Labels:** never 3D text meshes. Use an HTML/CSS overlay positioned by projecting world→screen, capped at ~25 visible labels (focused node + neighbors + nearest-to-camera). `troika-three-text` is the fallback if you want in-scene SDF text.
- **Progressive loading:** ship a small `skeleton.json` (id, type, shell, position, label — a few hundred KB gzipped) that renders the whole space immediately. Fetch per-entity detail JSON (`/data/entity/{id}.json`) only on click.

**Budget check:** the full skeleton at 15k nodes ≈ 1–3 MB gzipped. Acceptable. Full detail-inline would be 10–20 MB. Don't do that.

---

## 4. Free metadata sources

| Source | Gives you | Cost / limits | License |
|---|---|---|---|
| **MusicBrainz** | The backbone: artists, releases, recordings, **works** (cover→original links), performer relationships | Free. 1 req/sec, custom User-Agent required | Core data CC0 |
| **Cover Art Archive** | Album art keyed to MusicBrainz release IDs | Free, no key | Varies per image |
| **Discogs** | Deep **credits** — who engineered, who did the sleeve art | Free with token. 60 req/min authenticated | Data CC0; **images are not redistributable** |
| **Wikidata** | Bios, birth/death, band memberships, image links. SPARQL endpoint | Free | CC0 |
| **Wikimedia Commons** | Freely licensed photos of musicians | Free | Various CC — must attribute |
| **Archive.org** | Metadata API + audio embed | Free | Per-item |
| **Last.fm** | Tags, listener counts, similar artists | Free API key | Restricted |
| **ListenBrainz** | Listen data, open alternative to Last.fm | Free | CC0 |

**Practical ordering:** MusicBrainz first for structure. Discogs second for credits MusicBrainz lacks. Wikidata third for bios and images. Manual/site-data for everything about the tribute project itself, which won't be in any of these.

**Rate-limit math:** 2,000 MusicBrainz lookups at 1/sec = ~35 minutes per full pass. Totally fine — but cache every response to disk so re-runs are instant. Build the cache layer in Sprint 1, not later.

⚠️ **Do not redistribute Discogs images.** Use them for lookup, source the actual pixels from Cover Art Archive, Wikimedia Commons, or directly from the tribute project with permission.

---

## 5. Sprint plan

Two parallel tracks. The **Space Track** builds against synthetic data from Sprint 2 so it never blocks on the **Data Track**. This is the single most important scheduling decision in the plan.

### Sprint 1 — Foundations · Aug 24 – Sep 6

- [x] ~~Choose the name.~~ **Aliquot.** See §0.
- [ ] Create the GitHub repo (`aliquot`), **public** (§1.7 — keeps GitHub Actions genuinely unmetered, and serves the templating goal). Do not buy a domain yet — §1.4b.
- [ ] Scaffold: Vite + React + TS + R3F. Deploy to `aliquot.pages.dev` **on day one** so the deploy path is proven early.
- [ ] Scaffold the C# ETL console app + SQLite schema for the 5 node types and 7 edge types — **including `Person.handles[]` and `display_preference` from the start** (§2.1b). Retrofitting identity fields after 1,500 people are loaded is miserable.
- [ ] Build the HTTP cache layer (disk-backed, keyed by URL) and rate limiter.
- [x] ~~Set up the Airtable base(s) for §1.7c.~~ **Done — two bases, as the plan recommended.** `Aliquot Credentials` (just the `Credentials` table) kept separate from `Aliquot Claims` (`Claims` + `Admin Queue` tables), so entity-claim growth never threatens the Credentials base's headroom under the 1,000-record cap. See `docs/DECISIONS.md`.
- [x] ~~Get permission.~~ **Zach (the founder) gave his blessing.** Two follow-ups still open, worth asking while the conversation's warm rather than as a separate outreach later: how contributors want to be credited (name, handle, or both — §2.1b), and **whether original masters from contributing bands still exist anywhere** (§1.9) — likely the cleanest backup source there is.
- [x] ~~Spike R1: can you extract Bandcamp track embed IDs programmatically?~~ **Yes — confirmed against the full real catalog, 146 albums, 0 failures.** Every album page carries a `data-tralbum` HTML attribute holding HTML-entity-encoded JSON: album id, release date, and each track's id/title/artist/duration. Plain `HttpClient` GET + JSON-decode; no headless browser needed. **Separately: an actual downloadable file — also yes.** The same JSON exposes a signed, directly fetchable `mp3-128` `audio/mpeg` URL per track, even without Bandcamp's download feature enabled — confirmed via a real byte-range fetch matching the expected file size exactly. Caveat: the signed URL expires ~24h after the page is fetched, so backup harvesting must pull bytes promptly. **Catalog size correction:** the landing page's visible links cover only the newest ~16 releases; the other 130 (back to July 2014) only surface via a `data-client-items` JSON blob on `/music` used for lazy-loading — a first pass that scraped only visible links undercounted the catalog by ~9x before this was caught. See `docs/RUNBOOK.md` and `scripts/harvest-bandcamp.ps1`.

**Milestone M1:** site live at `aliquot.pages.dev`; ETL app talks to MusicBrainz and caches a response.

### Sprint 2 — Core catalog + renderer spike · Sep 7 – Sep 20

- [x] ~~Scope: Bandcamp metadata only, for now.~~ **Done.** All 146 albums / 3,830 tracks harvested (`scripts/harvest-bandcamp.ps1`) and landed untransformed into `bandcamp_album_raw` / `bandcamp_track_raw`.
- [x] ~~Normalize into: cover releases → cover recordings → covering artists.~~ **Done** via `Aliquot.Etl.Bandcamp.BandcampImporter`, idempotent (verified by re-running twice with identical output): 146 `release` rows, 3,830 `recording` rows, 1,249 distinct covering `artist` rows, 3,830 `appears_on` edges. Also added an 8th edge, `performed_by` (Artist → Recording) — outside §2.2's original 7, justified in `Schema.sql`'s own comment: Shell 2a (§2.3) needs recordings clustered around their covering artist now, and Bandcamp gives that directly without waiting on Sprint 3's person-level roster.
- [ ] Write a synthetic-graph generator (15k nodes, realistic edge density) for renderer testing.
- [ ] Renderer spike: InstancedMesh shells + LineSegments + OrbitControls. **Measure FPS with 15k nodes.**
- [ ] **Decision gate:** R3F or vanilla Three.js. Commit and don't revisit.

**Milestone M2:** every cover album and cover song is in SQLite. Synthetic graph renders at 60fps.

### Sprint 3 — Covering bands & members · Sep 21 – Oct 4

- [ ] Resolve covering-band roster: `MEMBER_OF` edges. Expect this to be largely manual — tribute-scene bands are under-documented in MusicBrainz.
- [ ] **Harvest forum handles** from the existing site/forum alongside names. This is source data you may only get one clean pass at — collect it now even where you don't yet know which person it belongs to.
- [ ] Person deduplication pass, **handle-first** (§2.1b, Risk R3). Build a review UI or just a SQLite query + spreadsheet workflow.
- [ ] Derive `SHARES_MEMBER` (*sympathetic*) edges.
- [ ] Assign each resolved person and covering band a sticky `slug` (§1.8) — current handle for people, band name for artists — with deterministic collision handling. **No bulk token generation** — `claim_token` is issued one at a time by you, on demand, once §1.6's claim flow exists (Sprint 4).
- [ ] Space Track: GPU picking, hover states, click-to-focus, focused-subgraph edge highlighting.

**Milestone M3:** the inner three shells (core, members, bands) are real data. You can click a band and see its members light up.

### Sprint 4 — Original artists & the cover→original link · Oct 5 – Oct 18

- [ ] MusicBrainz matching for original artists, releases, recordings.
- [ ] **The hard part:** resolve each cover recording to its original recording via `Work`. Build a confidence score. Queue low-confidence matches for manual review.
- [ ] Assign sticky `slug`s (§1.8) to original artists, and to every Recording and Release now that the catalog is resolved enough to know their parent artist.
- [ ] `FEATURES` and `SELECTED_BY` (§2.2) stay unlinked this sprint — sourcing them needs site/forum access that's outside the current Bandcamp-only blessing. Leave both edges entirely absent rather than partially populated from whatever leaks through Bandcamp's own liner notes; revisit once that's a separate ask to Zach.
- [ ] Manual reconciliation pass #1.
- [ ] **Systems Track:** build the claim page and its Pages Function — HMAC verification, private `aliquot-intake` bucket, upload form with consent checkbox (§1.6). **The local admin app (§1.7c):** login against Airtable, role check, the claim-issuance workflow (search entity → set email → generate token → show the URL to paste into your reply), the photo review queue. Build this now, not when the first real request arrives. **Same sprint:** the KV-backed bio/links/members endpoints (§1.7), including the existing-node picker for membership edits and the "suggest a new member" path into the admin queue. **Also this sprint:** the Contact-me Function (§1.7b) — Resend integration, hashed-IP rate limit in KV. No real content flows through any of this yet; prove all four pipes end to end with test data.
- [ ] Space Track: sub-orbit rendering (release/recording satellites clustered on their parent).

**Milestone M4:** ≥85% of cover songs are linked to a correct original recording.

### Sprint 5 — Layout, traversal, audio · Oct 19 – Nov 1

- [ ] Implement angular ordering (§3.1) in the C# exporter. Bake positions.
- [ ] JSON export pipeline: `skeleton.json` + per-entity detail shards.
- [ ] **Sync mode:** a second, lightweight ETL entry point — pull KV, pull `contact_email` presence from Airtable via its API (§1.7c, folded into the public-safe `claimed: true/false` flag, never the address itself), merge into `contributor_submissions`, regenerate JSON, sanity-check the output, commit only if there's a real diff. Wire it into a **scheduled GitHub Actions workflow running once daily, and no more** — admin actions (claim issuance, photo moderation) write to KV/R2/Airtable directly and never touch git themselves, so this scheduled job is the *only* path to a deploy (§1.7). `workflow_dispatch` stays available for a deliberate early run, not routine use.
- [ ] Renderer loads **real data** for the first time.
- [ ] **Deep-linkable routing** (§1.8): ship `slugs.json` (id ↔ slug lookup) alongside `skeleton.json`. On load, parse the URL path, resolve to an entity, fly the camera there, open its detail panel. On focus change, `pushState` the canonical URL — no router library, plain History API.
- [ ] "Walk the path": animated camera tween along an edge curve from node to node.
- [ ] Audio embeds: build the `AUDIO_PROVIDERS` registry and dispatcher (§1.9) — one lookup entry per provider, not a hardcoded pair. `bandcamp` and `archive_org` go live now; `r2` (and the registry slot for `youtube`, if it's ever used) sit ready but unused. **Same pass, opportunistically:** since the ETL is already visiting each track's source page for embed info, cache a downloadable copy where the source allows it (easy on Archive.org, dependent on Sprint 1's spike result for Bandcamp) into the private `aliquot-audio-backup` bucket. Background task, not a blocker — carries across later sprints if 800–2,000 files don't finish in one pass.
- [ ] **Decision point:** the name has survived three months of daily use. Buy `aliquot.org` and point it at Pages (§1.4b).

**Milestone M5:** 🎉 **Real system, real data, you can fly it and play a song.** This is the "it's actually happening" moment — protect this date.

### Sprint 6 — Detail panels & the list fallback · Nov 2 – Nov 15

- [ ] Detail panel per node type: bio, photos, external links, discography, credits. **A volume's panel shows "Featuring: ___" and "Selected by: ___" when `FEATURES`/`SELECTED_BY` exist (§2.2) — omitted cleanly, not blank, on volumes without a record.**
- [ ] **Person panels honour `display_preference`,** with the handle shown under a field labelled **FM**. Free version of the .fm pun; the people who were there will know why.
- [ ] **Destination list panel** — your own insight. When edges are dense, the user picks from a sorted, filtered, searchable list instead of clicking a line. Treat this as a *primary* navigation mode, not a fallback. **Same panel handles a broken or stale URL** (§1.8) — a friendly "that page has moved — search for it here," never a blank error.
- [ ] Global search with fuzzy matching.
- [ ] Breadcrumb / path history — where have I walked?
- [ ] Data Track: image pipeline. Fetch, resize to 256px thumb + 800px detail, convert to WebP, commit.
- [ ] **Make "Claim this page" visible for the first time** — no bulk mailing to send; the button on every unclaimed page is the whole distribution mechanism now. If it feels too passive, a single low-key forum post pointing at the site is plenty — the point is people request their own page, not that you chase every one down.
- [ ] **First moderation pass:** review the `aliquot-intake` bucket's `pending/` folder, promote approved photos through the resize pipeline into `aliquot-media`, delete rejects.

**Milestone M6:** every node type has a complete, useful detail view.

### Sprint 7 — Enrichment & the faint outer shell · Nov 16 – Nov 29

- [ ] Discogs credits pass for original releases → Shell 4 personnel. **This is the first thing to cut if you're behind.**
- [ ] Wikidata bio + image enrichment.
- [ ] Manual reconciliation pass #2.
- [ ] **Work through any claim requests that have come in** since Sprint 6 — verify, set `contact_email`, issue the token, reply. Plus a second moderation pass on new photo submissions.
- [ ] Mobile: touch controls, or a decision to serve mobile users a 2D/list-only view. (Be honest about whether a 15k-node WebGL scene is viable on a phone. It often isn't.)
- [ ] Accessibility: full keyboard navigation, screen-reader-accessible list view, `prefers-reduced-motion` handling.

**Milestone M7:** feature complete.

### Sprint 8 — Polish & hardening · Nov 30 – Dec 13

- [ ] Visual design pass: color language per shell, bloom/glow, starfield, **the empty fundamental at center — no star, per §0's thesis.**
- [ ] Onboarding: a 20-second guided intro flight for first-time visitors.
- [ ] Performance: Lighthouse, bundle size, texture atlasing, loading states.
- [ ] Cross-browser: Chrome, Firefox, Edge, Safari. (WebGL differences are real.)
- [ ] Write the "About" page — the actual tribute text. 13 years deserves real words.
- [ ] Open-graph cards so shared links look right.
- [ ] **Announce a claim-request cutoff date** — one forum post is enough, since there's no contributor list to chase individually. Give stragglers a firm last chance to ask.
- [ ] **Day-100 checkpoint (§1.9):** if time allows, begin the Archive.org backfill — upload original masters as your own item, register them in `audio_backups[]`. Not required for launch; a good use of any slack this sprint has.

**Milestone M8:** release candidate.

### Launch week · Dec 14 – Dec 22

- [ ] Final data refresh with the last cover album.
- [ ] **Final moderation pass** on the intake bucket before freeze.
- [ ] Freeze. Tag `v1.0`.
- [ ] Write the README as a **template guide** — this was a goal. Document the ETL config so someone else can point it at a different catalog.
- [ ] Announce.

**Milestone M9:** 🚀 live.

---

## 6. Risk register

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| **R1** | ~~Bandcamp has no public API...~~ **Resolved in Sprint 1.** Track-level embed IDs and a real downloadable `mp3-128` file are both extractable from the `data-tralbum` JSON blob embedded in every album page — confirmed against all 16 albums in the real catalog, 0 failures. Residual risk, downgraded: the signed download URL expires ~24h after fetch, so a backup harvest must pull bytes promptly, not just store the URL; and `bandcamp.com/robots.txt` carries a site-wide `Disallow: /` for `ClaudeBot` specifically — noted so any future AI-assisted work on this repo runs the harvester itself rather than fetching Bandcamp pages directly. | ~~High~~ **Low** — affects the core audio feature, but the mechanism is proven | `scripts/harvest-bandcamp.ps1` — one album per request, random 60-600s delay between albums, resumable, only touches paths robots.txt allows for generic crawlers. Backup-extraction fallback unchanged: founder's original masters (§1.9) still likely better quality than a 128kbps stream rip. |
| **R2** | **Cover→original matching is unreliable.** MusicBrainz Work coverage is uneven, especially for obscure originals. | High — it's the conceptual heart of the site | Confidence scoring + two manual reconciliation passes already budgeted (Sprints 4, 7). Accept 85% as success, not 100%. |
| **R3** | **Person deduplication.** "Dave Smith" appears on 6 albums — same human or three humans? | ~~High~~ **Medium** — downgraded once forum handles became the primary key (§2.1b) | Handle-first matching resolves most cases outright. Still never auto-merge on name alone. Surface candidates for review; when uncertain, keep separate — a false split is recoverable, a false merge silently poisons the graph. Residual risk is now concentrated in Shell 4 personnel, who have no handles. |
| **R4** | **Scope creep from Shell 4** (original-record personnel). Highest data volume, lowest payoff per record. | Medium | Explicitly optional. First item on the cut ladder. |
| **R5** | **Image licensing.** Discogs images can't be redistributed; Commons images require attribution; submitted photos need explicit consent. | Medium — legal | Source policy documented in §4 and §1.6. Build an attribution field into the image table from day one. Submitted photos require the consent checkbox before they can even reach `pending/`. |
| **R6** | **Performance collapse** at full data scale after building against synthetic data. | Medium | Synthetic generator matches real scale *and edge density* from Sprint 2. Test with 20k nodes, not 15k. |
| **R7** | **Consent.** Living people's photos and bios republished without asking. | Medium — human, not just legal | `display_preference` (§2.1b) turns this from an opt-out into a question asked up front: name, handle, or both. Sprint 1 permission task. Visible contact on the site regardless. |
| **R8** | **Four months is aggressive** alongside a full-time job. | High | The cut ladder below. Milestone M5 is the real deadline; everything after is enhancement. |
| **R9** | **Claim/edit surface** (§1.6, §1.7) — impersonation, wrong files, inappropriate content, spam links, dead links, someone instantiating a fake person. | ~~Medium~~ **Lower** — downgraded once issuance moved from bulk-mailed to admin-verified (§1.6) | Tokens now don't exist until you've checked a request, closing the "leaked mailing list" failure mode entirely. Photos still get a hard moderation gate; links/bio still get automated checks only, since a URL either parses or it doesn't; membership edits can only *reference* existing nodes, never create one — a new person always routes through the same admin queue as a claim request. |
| **R10** | **Slug link rot** (§1.8). If slugs were ever recomputed fresh on rebuild instead of persisted, an unrelated catalog addition could silently shift a collision and reassign someone's URL out from under them. | Medium — breaks exactly the shareability this feature exists for | Slugs are assigned once and stored, never recomputed. Layer 1 (`/n/{id}`) is unaffected regardless, since it never depended on slug logic in the first place. |
| **R11** | **YouTube ContentID** (§1.9). Uploading cover recordings — as opposed to embedding something already posted by someone else — can trigger automated matching against the original song's rightsholder: mutes, monetization-against-you, or takedowns. | Low likelihood, but worth naming rather than assuming YouTube is a free option | YouTube stays available in the provider registry but isn't the default backup choice. R2 and an Archive.org item (§1.9) don't carry this exposure at all. |
| **R12** | **New dependency: Resend** (§1.7b). The contact-relay feature is the one place this plan needs an actual email-sending service — everything else is you mailing by hand. | Low | <cite index="27-1">Free tier (3,000/mo, 100/day) is a permanent tier, not a trial,</cite> and won't be approached at this site's scale. If Resend ever changes terms, the relay Function is small enough to repoint at any equivalent API in an afternoon — it's one Function, not a system. |
| **R13** | **Rebuild frequency / deploy safety** (§1.7). Frequent, uncontrolled rebuilds from every admin action would multiply the odds of shipping a broken build and make it harder to reason about what's live at any moment. | Low — architectural, not incidental | Admin actions write only to KV/R2, never to git; exactly one scheduled job per day is the sole path to a deploy, with a pre-push sanity check and a diff-only commit. A failed build doesn't take the live site down — the last successful deploy keeps serving regardless. |
| **R14** | **New dependency: Airtable** (§1.7c). Free-tier limits have tightened before — <cite index="151-1">the record cap per base dropped from 1,200 to 1,000 in February 2026</cite> — and it's now where credentials and possibly entity contact data live. | Low | Never on the visitor-facing path — an outage or a tightened limit only ever delays *you* processing something, since tokens stay stateless and verify without querying Airtable at all. Splitting credentials from entity data into separate bases keeps well clear of the record cap regardless. |

---

## 7. Scope cut ladder

If you're behind, cut in this order. Decide by looking at the ladder, not by improvising at 11pm.

1. **Shell 4** — original-record personnel. Cut entirely.
2. **The whole claim/edit system** (§1.6, §1.7) — fall back to fully curated content, no visitor-facing editing at all. This is now the deepest cut available, since the admin-verified model already *is* the conservative version — there's no lighter tier left above "you enter everything by hand."
3. **The Contact-me relay** (§1.7b) — fall back to no contact mechanism, or a single project-wide contact address instead of per-entity relay. Drops the Resend dependency (R12) entirely if that's ever worth doing.
4. **Pretty slugs — Layer 2 of §1.8.** Fall back to Layer 1 only: every node still has a working, shareable `/n/{id}` URL, just not a vanity one. The bidirectional address-bar sync stays either way.
5. **Proactive audio backup harvesting, either tier** (§1.9). The provider registry and dispatcher stay — cheap, worth keeping regardless — but actually populating R2 or Archive.org with backup files can slip to post-launch (day 100+) entirely. Embed-only launch is fully functional either way; this is insurance, not the product.
6. **Sub-orbit satellites** for original releases — collapse originals to artist-level nodes.
7. **Bios and photos** for original artists — link to Wikipedia instead.
8. **"Walk the path" camera animation** — instant cut-to instead of tweened flight.
9. **Mobile 3D** — serve the list/search view on phones.
10. **Guided intro flight.**
11. **`SHARES_MEMBER` visual edges** — keep the data, show it only in the detail panel as a list.

Everything above the line stays: the core, covering members, covering bands, cover songs with audio, original artists, and the cover→original link. **That is the site.** The rest is decoration on top of a complete idea.

---

## 8. Working practices for a 4-month solo build

- **One sprint = one demo-able thing.** If a sprint ends with nothing you can show someone, the plan slipped and you should look at the cut ladder.
- **Deploy on day one and every sprint.** A deploy path you don't exercise is a deploy path that breaks in week 15.
- **Cache every API response to disk.** Non-negotiable. Re-running the ETL should take seconds, not 40 minutes.
- **The SQLite file is the source of truth**, and it's committed or backed up. JSON is a build artifact, always regenerable, never hand-edited.
- **Two override tables, kept separate, never merged:** `manual_overrides` for your own hand corrections, `contributor_submissions` for the KV-synced content from §1.7. Neither is edits to imported rows directly — re-import must never destroy either kind of hand work. `manual_overrides` changes rarely and only at your hand; `contributor_submissions` is *expected* to be fully replaced every sync run, since KV is its actual source of truth. Conflating the two tables would mean a stale contributor sync silently clobbering a correction you made by hand, or vice versa — worth the extra table to avoid.
- **Keep a `DECISIONS.md`** — every architecture call with a date and one line of reasoning. Four months from now you will not remember why you picked something, and re-litigating it costs a day.
- **Keep a `RUNBOOK.md`** — specifically, the Bandcamp failover steps from §1.9, written out as a checklist before you ever need them. If that day comes, it should be a document you follow, not a plan you improvise under pressure.

---

## 9. Open questions to settle in Sprint 1

1. How many cover releases are there, precisely, and does each have a Bandcamp *and* an Archive.org presence, or does it vary by year?
2. ~~Does the existing site/database have a clean export...~~ **Moot for now — Zach's current blessing is Bandcamp metadata only.** A separate site/forum export is a future ask, not a Sprint 1 task.
3. Are covering-band memberships already recorded anywhere reachable from Bandcamp itself, or does that roster have to be reconstructed by hand from what's on the release pages?
4. ~~Who owns the tribute project, and are they on board with this?~~ **Zach owns it, and he's on board.** Still open: whether he wants to be a content contributor for the bios himself, or just a blessing-giver.
5. Should the site be bilingual / does the project have an international contributor base worth accommodating?
6. **Confirmed: members recorded the "who selected whom" history as it happened — but it's out of scope for now.** It almost certainly lives on the site or forum, not on Bandcamp itself, and that access isn't part of the current blessing. Worth raising with Zach as its own, later ask — not bundled into the metadata conversation that's already settled.
