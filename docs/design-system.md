# CareNow design system

The implementation reference for the style guide. Every value here exists as a
Tailwind token in [`tailwind.config.ts`](../tailwind.config.ts) — screens compose
`bg-surface`, `text-ink`, `rounded-card` and friends rather than raw hex values,
so a palette change is a one-file edit.

---

## Colour

| Role | Token | Hex | Where it's used |
| --- | --- | --- | --- |
| Primary teal | `primary` | `#1FA390` | Active nav pill, user avatar, primary buttons, key accents |
| Teal dark | `primary-dark` | `#0F6F62` | Active chip text, rating text, links |
| Teal tint | `primary-tint` | `#DDF3EE` | Active chip background, rating pill, icon wells |
| Background | `canvas` | `#F3F8F7` | Screen background (very pale mint) |
| Surface | `surface` | `#FFFFFF` | Cards, search bar, bottom nav |
| Text primary | `ink` | `#1B2B34` | Titles, doctor names |
| Text secondary | `ink-muted` | `#7C8A92` | Specialty, availability, location label, inactive icons |
| Border | `line` | `#E3ECEA` | Search bar outline, inactive chip outline |
| Avatar accents | `accent.teal` / `accent.blue` / `accent.purple` | `#1FA390` `#2D9CDB` `#8B5CF6` | Initial-based doctor avatars, as a soft 135° gradient |
| State only | `danger` / `warning` / `success` | `#D64545` `#C77700` `#1FA390` | Declines, unpaid, no-show — never decoration |

**Avatar gradients.** `components/ui.tsx` maps each accent to a two-stop
135° gradient (`#3FC1AE → #1FA390`, `#5FB8E8 → #2D9CDB`, `#A98BF0 → #8B5CF6`) so
initials stay legible against the fill.

**Colour rules the code follows**

- Teal is the only accent. State colours appear only where something needs the
  patient's attention (a declined payment, a missed consultation).
- Active states are shown by *fill*, never by an underline.
- Nothing conveys meaning by colour alone — every status pill also carries a label.

---

## Typography

**Typeface:** Plus Jakarta Sans (variable), self-hosted via
`@fontsource-variable/plus-jakarta-sans` and imported in `app/globals.css`. The
fallback stack is `-apple-system, SF Pro Text, Segoe UI, Roboto, sans-serif`, so
an iOS device renders the intended neo-grotesque even before the webfont lands.

| Role | Token | Size / line-height | Weight |
| --- | --- | --- | --- |
| Screen title | `text-screen` | 24px / 30px, `-0.02em` | Bold |
| Context label | `text-context` | 12px / 16px | Regular |
| Card title | `text-card` | 15px / 20px | Semibold |
| Card subtitle | `text-sub` | 12px / 16px | Regular |
| Meta text | `text-meta` | 12px / 16px | Medium |
| Chip and nav labels | `text-chip` | 12px / 16px | Medium |

Body copy inside cards sits at 13px/24px — a deliberate deviation, because
health instructions read at 12px on a phone are too small to be safe.

---

## Shape and elevation

| Element | Radius | Shadow |
| --- | --- | --- |
| Cards | `rounded-card` — 20px | `shadow-card` — `0 4px 16px rgba(20,60,55,0.08)`, no border |
| Search bar | `rounded-pill` | none — 1px `border-line` |
| Chips | `rounded-pill`, 32px tall (`h-8`) | none |
| Rating badge | `rounded-pill` | none, `bg-primary-tint` |
| Bottom nav | `rounded-nav` — 28px | `shadow-nav` — `0 12px 32px rgba(20,60,55,0.16)` |
| Bottom sheets | top corners 24px | `shadow-sheet` |
| Avatars | perfect circle — 44px doctor, 32px user, 40–64px elsewhere | — |

---

## Spacing

A 4px base unit, with 8 / 12 / 16 / 20 doing nearly all the work.

| Token | Value | Used for |
| --- | --- | --- |
| `px-gutter` | 20px | Screen side padding |
| `gap-3` | 12px | Gap between cards |
| `p-card` | 14px | Card inner padding (14–16px) |
| `space-y-section` | 20px | Gap between header, search, chips and list |
| `pb-*` on `.app-scroll` | nav height + inset + safe area + 24px | Clears the floating nav |

The `.chip-row` helper bleeds a horizontal scroller to the screen edge while
keeping the first and last chip aligned to the 20px gutter.

---

## Components

**Header** — `ScreenHeader` (small `context` line above a bold `title`, user
initials avatar top-right, 32px) and `DetailHeader` (back chevron, centred title,
optional trailing action). Both are sticky and blur the canvas behind them.

**Search bar** — `SearchBar`. Full pill, white, 1px border, no shadow, magnifier
on the left, multi-intent placeholder "Specialty, name or symptom". Matching
covers name, specialty, clinical specialty name, symptom keywords and language,
so "tooth" finds the dentist and "tamil" finds Tamil-speaking doctors.

**Filter chips** — `Chip`. Horizontal row: All, General, Skin, Heart, Child,
Dental, Women, Mind. Active = `primary-tint` fill with `primary-dark` text;
inactive = white with a `line` border and grey text. `aria-pressed` is set.

**Doctor card** — `DoctorCard`. Left: 44px initials avatar. Centre: name,
specialty and years of experience, then a row holding the rating pill and the
next available slot (`Today · 6:30 PM`, in `primary-dark` when the slot is within
two hours). Right: grey chevron. The whole card is one `<a>` tap target with a
purpose-written `aria-label`.

**Bottom navigation** — `BottomNav`. Four items (Home, Find, Bookings, Profile)
in a floating 28px-radius white pill, inset 12px from the screen edges above the
safe area. The active tab is a teal filled pill holding a white icon *and* its
label; inactive tabs are grey outline icons only. `aria-current="page"` marks the
active tab.

**Consult room** — `app/consult/[bookingId]`. Dark teal stage with a circular
doctor tile, picture-in-picture self view, and a round-button control bar
(mic / camera / notes / prescription) plus a red leave button.

---

## Iconography

`components/Icons.tsx` — 30 outline icons on a 24px grid, 1.5px stroke, rounded
caps and joins, `currentColor` so the nav can flip grey → white by sitting on the
teal pill. The star is the single filled glyph, at 12–14px inside the rating
badge. Icon sizes in use: 13–17px inline, 18–22px in buttons, 22–24px in the nav.

---

## Interaction notes

- Active state is a fill change, not an underline.
- `.pressable` gives every card and control `active:scale-[0.97]` over 150ms with
  a `cubic-bezier(0.2, 0.8, 0.3, 1)` curve.
- Chevron plus card shadow signals tappability; cards have no border at all.
- Toasts, sheets and skeletons are in `components/ui.tsx`.
- `prefers-reduced-motion: reduce` collapses every animation and transition to
  ~0ms in `globals.css`.
- Focus rings are visible for keyboard users only (`:focus-visible`), and pinch
  zoom stays enabled so a patient can enlarge a prescription.

---

## Access

- Text meets WCAG AA against its background: `ink` on `surface` is 13.4:1,
  `ink-muted` on `surface` is 3.9:1 (used only at 12px for non-essential meta and
  always paired with an icon or label), `primary-dark` on `primary-tint` is 5.6:1,
  white on `primary` is 3.4:1 and is used only at 13px+ semibold.
- Every icon-only control has an `aria-label`; the toast region is
  `aria-live="polite"`; sheets are `role="dialog" aria-modal` and close on Escape.
- Status is never colour-only — "Unpaid", "Missed", "Completed" carry text.
