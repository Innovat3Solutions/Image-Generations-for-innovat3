# Excavation Kings — Website Concept & Lead-Funnel Strategy

**Design read:** B2B lead-generation landing page for an excavation/demolition contractor, aimed at general contractors, roofers, developers, and commercial property owners — heavy industrial, cinematic, confident visual language on an asphalt-black + safety-yellow brand world pulled from their logo.

---

## 1. The Big Concept: "THE 24-HOUR BID"

Contractors don't browse websites — they need a number, fast, from a sub they can trust to hit dates. So the entire site is built around one promise that doubles as the lead engine:

> **Send us your plans. We walk the site. You get a locked bid in 24 hours.**

Everything on the page exists to push a visitor into that funnel or to remove the doubt that stops them ("are they insured?", "can they handle my volume?", "will they wreck my schedule?"). The brand attitude comes from their own tagline — *We Dig It Better* — translated into a site that feels like heavy machinery: dark, massive type, dust-and-amber photography, safety-yellow used the way it's used on real equipment: sparingly, and always meaning "act here."

### Narrative spine
**Tool / precision instrument** — big machines, exact numbers. Every section pairs raw demolition imagery with disciplined, calibrated UI (thin hairlines, indexed labels, locked grids). The subtext: *these people are violent with concrete and surgical with schedules.*

---

## 2. Audience & Funnel Map

| Stage | Visitor | Mechanism |
|---|---|---|
| **Traffic** | GCs, roofers, pool/driveway removal, developers | Google LSA + PPC ("demolition contractor near me", "concrete removal [city]"), GC referrals, yard signs w/ QR |
| **Hook** | Needs demo/excavation priced into their own bid | Hero promise: bid in 24 hours |
| **Proof** | "Can I trust them on my job site?" | License/insurance strip, fleet, metrics, GC testimonial, before/after projects |
| **Primary conversion** | Ready to price a job | **24-Hour Bid form** (name, company, project type, timeline, phone) |
| **Urgent conversion** | Machine down / deadline tomorrow | Click-to-call, phone number persistent in nav |
| **Slow-lane capture** | GC bidding work months out | **Capability Statement PDF** download (email capture) → drip follow-up |
| **Nurture** | Submitted but not closed | 24h bid delivery email → 3-day follow-up → monthly "recent projects" email |

**KPIs:** form submits, calls from site, PDF downloads, bid-to-close rate. Wire the form to CRM + instant SMS notification so the 24-hour clock is real.

---

## 3. Page Architecture (6 sections, one render each)

| # | Section | Job in funnel | Composition anchor | Background mode |
|---|---|---|---|---|
| 1 | Hero | Hook + primary CTA | Bottom-left over image | Full-bleed cinematic photo, dark overlay |
| 2 | Trust strip | Kill the risk objection | Stacked center (mini section) | Solid asphalt, micro-noise |
| 3 | Services — "The Dirty Work" | Educate: what we take on | Full-width accordion slices | Duotone-graded photo slices |
| 4 | The 24-Hour Bid process | Convert: how easy it is | Top-left lead, CTA bottom-right | Bone paper solid (light contrast section) |
| 5 | Proof | Evidence: metrics + GC quote | Off-grid editorial offset | Dark solid + layered photo crops |
| 6 | Final CTA + bid form | Close | Centered-low over image | Image-as-canvas (graded pad at sunrise) |

**Design system commitments** (consistent across all renders):
- **Palette:** asphalt `#141414` surfaces · bone `#EDEAE3` text/paper · safety yellow `#F2B90D` accent (CTAs and indexes only) · steel-grey hairlines
- **Type:** ultra-condensed heavy grotesque, ALL CAPS for display (Monument/Druk energy); clean neutral grotesk for body and labels
- **Photography:** cinematic warm amber-dust grade, slightly desaturated; real machines on real sites — never clip-art
- **Motion language (for build):** pinned narrative sections + parallax image drift (GSAP ScrollTrigger)
- **Second-read moment:** one black/yellow hazard-chevron divider, used exactly once — atop the closing CTA section
- **Logo:** renders use a placeholder crown icon + "EXCAVATION KINGS" wordmark; the real logo file drops in at build time (place it in `generations/refs/` to re-render with pixel-true placement)

---

## 4. Master Rendering Prompt

Append this brand-world block to every section prompt so all frames read as one site:

> Premium website UI design reference, desktop landing page section, Awwwards-level art direction, flat crisp UI rendering with sharp legible interface text, no browser chrome. Brand: Excavation Kings, an excavation and demolition contractor. Color system: asphalt black #141414 surfaces, bone off-white #EDEAE3 text and paper tones, safety yellow #F2B90D accent used sparingly for CTAs and index labels, thin steel-grey hairlines. Typography: ultra-condensed extra-bold grotesque display type in ALL CAPS for headlines, clean neutral grotesk for body copy and small labels. Photography treatment: cinematic job-site imagery, warm amber dust color grade, slightly desaturated, heavy machinery in action. Generous spacing, confident negative space, premium industrial mood — never clip-art, never cartoonish.

### Section prompts

**S1 — Hero (21:9):** Full-bleed background photo: large tracked excavator tearing into a concrete slab at dusk, backlit amber dust cloud, dark tonal gradient overlay strongest at the bottom. Slim top nav: small yellow crown icon with "EXCAVATION KINGS" wordmark left; links "Services  Process  Projects", phone number, and a small yellow button "Get a Bid" right. Anchored bottom-left: tiny yellow caps label "DEMOLITION · CONCRETE REMOVAL · EXCAVATION · GRADING", massive two-line condensed caps headline "WE TEAR IT DOWN. YOU BUILD ON TOP.", one short sub-line "Licensed demo and dirt-work crews for contractors who live on deadlines.", then a safety-yellow pill button "Get a bid in 24 hours" beside a ghost outline button "See our work".

**S2 — Trust strip (16:9, mini):** Solid asphalt with faint grain, lots of negative space. Stacked center: small yellow caps label "BUILT FOR CONTRACTORS", one centered line of separated items "Licensed & Insured — $2M Liability — OSHA-Trained Crews — 24-Hour Bid Guarantee", and below, a muted grey row of partner wordmarks (Meridian Builders, Northpoint Roofing, Calder Construction, Stonebridge Development).

**S3 — Services accordion (16:9):** Four full-height vertical photo slices across the frame. First slice expanded (~40% width): duotone demolition photo, index "01", headline "DEMOLITION", copy "Structures down, debris gone, site swept.", thin yellow arrow link "See demolition work". Three compressed slices with vertical caps labels and indexes: "02 CONCRETE REMOVAL", "03 EXCAVATION & GRADING", "04 LAND CLEARING". Hairline separators, yellow indexes.

**S4 — Process (16:9, light):** Bone paper background, near-black text — deliberate contrast flip. Top-left: yellow caps label "THE 24-HOUR BID", condensed caps headline "A LOCKED NUMBER. NOT A GUESS." Three columns with huge ghosted outline numerals 01 / 02 / 03: "Send your plans" — "Upload drawings or snap photos."; "We walk the site" — "A estimator on your dirt within a day."; "Bid in your inbox" — "Locked scope and price in 24 hours." Bottom-right: underlined arrow link "Start your bid →", plus a small photo crop of gloved hands over site drawings.

**S5 — Proof (16:9):** Asphalt background, off-grid composition. Left: two overlapping layered photo crops (building mid-collapse; the same lot graded flat) with thin bone borders, small caps caption "BEFORE / AFTER — RETAIL PAD, 6 DAYS". Right: oversized condensed metrics stacked "1.2M yd³ MOVED", "340+ STRUCTURES DOWN", "98% ON-TIME" with yellow underline accents, then a short quote in bone italic: "They hit every date we gave them." — Site Superintendent, Meridian Builders.

**S6 — Closing CTA (16:9):** Image-as-canvas: wide sunrise photo of a perfectly graded, empty dirt pad with fresh machine tracks, soft dark overlay. A single thin black-and-yellow hazard-chevron divider along the top edge. Centered-low: condensed caps headline "YOUR SITE. READY.", sub-line "Demo, dirt, and haul-off — handled.", a compact dark form card with four fields "Name", "Company", "Project type", "Phone" and a full-width yellow button "Request my 24-hour bid", small line beneath "or call (704) 555-0119 — WE DIG IT BETTER".

---

## 5. Build Notes (when this goes to implementation)

- Form → CRM webhook + SMS alert; auto-reply email starts the 24-hour SLA clock.
- Sticky mobile footer bar: "Call" + "Get a Bid" (traffic will be majority mobile from LSA).
- Capability Statement PDF gated behind email — the slow-lane GC lead magnet.
- Service-area map + city landing pages later for SEO ("concrete removal charlotte" etc.).
- Real project photos replace stock the moment they exist; the color grade recipe above keeps them on-brand.
