# Landing page template attribution

The marketing page (`src/pages/Landing.tsx`) is built on **Asme**, an
open-source landing-page template, recast for this product.

- Repository: https://github.com/MohammadShehadeh/hirael
- Author: MohammadShehadeh
- Licence: MIT — full text in `docs/ASME_LICENSE.txt`
- Commit: 85b198f0ab19238ac3bdfe410cd9766d065b1974
- Upstream preview: https://hirael.com/templates/asme

## What was taken

The visual language, not the code: the pure-black palette, the
`liquid-glass` surface treatment (inset highlight plus a masked gradient
border), the `glow-top` / `glow-center` radial washes, the pill navbar and
buttons, Instrument Serif italic accents, the section rhythm (hero →
statement → featured → philosophy → services → footer), and the giant
wordmark watermark in the footer.

## What differs

- Amber (`#f2a53c`) is kept as the single accent; upstream is monochrome.
- The template is Next.js and depends on `motion`. This app is Vite, so the
  scroll-reveal is a small `Reveal` component built on `IntersectionObserver`
  plus a CSS transition — same effect, no new dependency.
- Upstream's background and section videos are replaced by this product's own
  live pieces: the drift canvas, the mutation panel, the cluster
  constellation, the loop diagram and the inline SVG micro-visuals.
- Fonts load from Google Fonts at runtime from the landing page only, rather
  than through `next/font`.
