# 3D build list (from the Figma picking board)

Direction (owner, 2026-10-21): the site becomes all 3D renders, with no mix of photos and 3D. Each shape is modelled
once to match one locked reference, then its colours. Source: Figma `jHQuCz5VUzOveyLVbn5jV9`, page "3D renders"
(29:564), board 31:26 plus the owner's comments #1–#8 and dropped-in reference images.
Cuts from the board are in `content/removed.json` (reversible).

Reference images here are web screenshots (licence: reference-only). Model from them; never ship them.

| Shape | Reference to match | Owner's note | Starting point |
|---|---|---|---|
| Skull | `skull-pastel.png` (Figma 29:579) | #3 "make the skull like this instead" | BUBS 3D (`src/three/candies/bubs.ts`); colours: the kept BUBS skull variants |
| Fish | Pastellfiskar green hero (`assets/candies/pastellfiskar/hero.png`) | #8 "3D needs to look more like the Pastellfiskar green fish" | Pastellfiskar 3D; colours: yellow, salt sill (black), red fruit fish |
| Car | `car-pink.png` (Figma 29:577) | #2 "looks pretty good as is, make it pink like this" | Ahlgrens bilar hero photo (the old 3D card was removed) |
| Bottle | `bottle-cola-bottles.png` (Figma 29:573) | #1 "change bottle to this image" | new (replaces Malaco Colaflaskor photo) |
| Fried egg | `fried-egg.png` (Figma 29:581) | #4 "use this egg image instead" | new |
| Strawberry | `strawberry.png` (Figma 29:571) | #5 "add a strawberry like this" | new |
| Rambo (strawberry–vanilla stick) | `rambo-strawberry-vanilla.png` (Figma 29:572) | #6 "add one of these guys" | new |
| Marshmallow | `marshmallow-pink.png` (Figma 29:570) | #7 "add a marshmallow" | new |
| Pillow (Polkagris) | `pillow-polkagris.png` (Figma 29:575, placed in the Polkagris 3D card, no comment) | (kept the 3D, dropped the photos) | Polkagris 3D |
| Djungelvrål | Djungelvrål hero (`assets/candies/djungelvral/hero.png`) | kept 3D + hero | Djungelvrål 3D |
| Pacifier | Sura Colanappar (`assets/candies/cola/variant-sura-colanappar.png`) | kept only this one | Cola 3D (removed card) as geometry start |
| Diamond | Tutti Frutti Diamond (`assets/candies/bubs/variant-tutti-frutti-diamond.png`) | kept | new |
| Disc | Orange fruit disc (`assets/candies/gott-blandat/variant-orange-fruit-disc.png`) | kept | new |
| Cherry | Gummy cherry (`assets/landing/cherry-upright.png`) | kept | new |

Open questions for the owner:
- The site is still organised by brand (candy pages). With shapes as the unit, should candy pages become shape pages?
- Cola and Gott & Blandat lost their hero and 3D but keep pieces. Their pages still show the old hero for now.
- Build order: one shape at a time, owner approves each before the next (same rule as 3D_CANDY_GUIDELINES.md).
