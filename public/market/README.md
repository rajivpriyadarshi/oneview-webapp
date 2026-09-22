# Market band imagery

The three photographs behind Eleanor's "Market context" band, referenced by `image` on the
`market.context` rows in `app/lab/generative-ui/eleanor.ts`:

| File | Article | Plate |
| --- | --- | --- |
| `singapore-residential.jpg` | Singapore private residential prices | lead card, 300px tall |
| `bank-of-england.jpg` | Bank of England base rate | small card, 148px tall |
| `kuala-lumpur-office.jpg` | Kuala Lumpur office vacancy | small card, 148px tall |

Each is cropped toward its plate's aspect so that `object-cover` does not lose the subject —
the Bank of England source was portrait and is cropped to the pediment and colonnade.

If a file is missing or fails to load, `Art` in `leaves.tsx` falls back to a tinted plate
rather than a broken image: the band is about the claim in the headline, and a photograph is
never the source of a fact here.
