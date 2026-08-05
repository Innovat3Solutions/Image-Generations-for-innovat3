# The Snack Shack Bakery — Website Concept

A complete, self-contained website concept for The Snack Shack Bakery (Deltona, FL),
built around their mascot **Milk, the Raccoon** and their real menu, prices, policies,
reviews, and product photography pulled from their live Bakesy shop.

## Files

- `index.html` — the entire site in one file (fonts, photos, and icons inlined).
  Open it in any browser, no server needed.
- `src/` — the editable pieces plus `build.py`, which stitches them together:
  - `part1-style.html` — design tokens + all CSS
  - `part2-top.html` — icon sprite, Milk SVG poses, nav, ticker, hero, restock board, favorites, menu
  - `part3-bottom.html` — box builder, how-it-works, tracker, Meet Milk, merch, reviews, FAQ, visit, footer, cart/checkout
  - `part4-js.html` — cart, checkout, box builder, tracking demo, tabs, reveals
  - `imgs/` — optimized product photos (from the client's Bakesy listings)
  - `fonts/` — Baloo 2 + Nunito woff2 (Google Fonts, OFL license)

Rebuild after editing any part:

```
python3 src/build.py   # writes index.html and artifact.html next to the parts
```

(The build script resolves `{{IMG:...}}`, `{{FONT:...}}`, and `{{ICON:...}}` tokens
into data URIs, so run it from the `src/` directory or adjust paths.)

## Sections

1. Sticky nav + cart
2. Announcement ticker (hours, lead time, delivery fees)
3. Hero — Milk holding a cookie next to real product photos
4. Today at the Snack Station — daily restock board with stock states
5. Shack favorites — horizontal product rail
6. The whole menu — 5 tabbed categories, real items and prices
7. Build your cookie box — interactive Cookie Rookie ($40/6) & Snack Pack ($65/12) picker
8. How ordering works — their real 4-step policy flow
9. Order tracking — demo timeline with SMS-style updates (cooler slot + passcode)
10. Meet Milk — mascot story
11. Merch shelf — real merch with photos
12. Reviews — real 5.0/19 Bakesy reviews
13. FAQ & policies — their real answers
14. Visit — address, hours, payments, illustrated map
15. Footer with Milk peeking over the grass

All ordering/tracking is demo-mode (no payments processed). Business rules are wired
in: $20 order minimum, 9-day lead time on the date picker, $0/$10/$15 fulfillment fees.
