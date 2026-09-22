# Market context art

Three placeholders for the news cards in the property report's market band
(`NewsImpact` in `app/lab/generative-ui/leaves.tsx`). The file names are the
`image` paths in `app/lab/generative-ui/eleanor.ts`:

- `singapore-residential.jpg` — Singapore private residential, lead card (wide, ~1200×800)
- `bank-of-england.jpg` — the Bank of England, small card (~800×600)
- `kuala-lumpur-office.jpg` — a Kuala Lumpur office interior, small card (~800×600)

Drop the real files in here under these names and they appear. Until then the
renderer draws the tinted plate: `Art` catches the load error and falls back, so a
missing file costs the card its picture and nothing else. Nothing in the image
carries information — every claim on the card is in its text.
