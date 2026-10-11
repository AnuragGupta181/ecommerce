# Design System

Haat looks like a warm, confident local store. It is **sunflower yellow on white with warm ink-black text**. The style is flat and crisp, with generous whitespace.

There are deliberately no purple/blue gradients, glassmorphism, neon glows or emoji decoration.

## 1. Principles

1. **Yellow is a highlight, not a wallpaper.** Use it for primary actions, the active nav pill, badges and key surfaces such as the home header. Body backgrounds stay white or warm off-white.
2. **Ink on yellow, never white on yellow.** White text on yellow fails contrast.
3. **Prices are the hero.** The selling price is bold ink, the MRP is struck through in muted ink, and the discount is green.
4. **One primary action per screen.**
5. **Rounded but not bubbly.** Use radius 12 for cards and inputs, and full radius for pills and chips only.

## 2. Colour tokens

| Token | Hex | Usage |
|---|---|---|
| `brand-50` | `#FFFBEB` | tinted page sections, selected rows |
| `brand-100` | `#FFF3C4` | chips, soft badges, coupon card bg |
| `brand-200` | `#FFE68A` | hover on soft surfaces |
| `brand-400` | `#FFD43B` | hover of primary |
| **`brand-500`** | **`#FFC727`** | primary buttons, active pill, header |
| `brand-600` | `#E6A800` | pressed primary, focus ring |
| `brand-700` | `#9A6B00` | yellow-ish text on white (links, "coins") |
| `ink-900` | `#1C1A14` | primary text, text on yellow |
| `ink-700` | `#3F3B2F` | secondary headings |
| `ink-500` | `#7A7465` | secondary text, MRP strike |
| `ink-300` | `#C8C2B2` | placeholders, disabled |
| `line` | `#ECE8DC` | borders, dividers |
| `canvas` | `#FAF8F3` | app background behind cards |
| `surface` | `#FFFFFF` | cards, sheets, inputs |
| `success` | `#16A34A` | "% off", delivered, savings |
| `success-soft` | `#E8F7EE` | savings banner background |
| `danger` | `#DC2626` | errors, cancel, out of stock |
| `danger-soft` | `#FDECEC` | error banner background |
| `info` | `#2563EB` | informational status (shipped) |
| `warning` | `#D97706` | low stock |

### Order status colours

| Status | Colour |
|---|---|
| PLACED | ink-700 on brand-100 |
| CONFIRMED / PACKED | info |
| RIDER_ASSIGNED / OUT_FOR_DELIVERY | brand-700 on brand-100 |
| DELIVERED | success |
| CANCELLED / RETURN_REJECTED | danger |
| RETURN_REQUESTED / RETURNED | warning |

## 3. Typography

- **Font:** *Plus Jakarta Sans*. It is used on the admin via `next/font/google` and on mobile via `@expo-google-fonts/plus-jakarta-sans`.

| Style | Size / line height | Weight |
|---|---|---|
| Display | 28 / 34 | 800 |
| H1 | 22 / 28 | 700 |
| H2 | 18 / 24 | 700 |
| H3 | 16 / 22 | 600 |
| Body | 14 / 20 | 500 |
| Small | 12 / 16 | 500 |
| Price | 18 / 22 | 800 (tabular numbers) |

## 4. Spacing, radius, elevation

- Spacing follows a 4-pt scale: 4, 8, 12, 16, 20, 24, 32, 40.
- **Radius:**

  | Element | Radius |
  |---|---|
  | input / button | 12 |
  | card | 14 |
  | sheet | 24 (top corners) |
  | pill / chip | 999 |

- **Elevation:** cards use a 1 px `line` border with no shadow. Only floating elements (bottom pill nav, sticky CTA bar, toasts) get a soft shadow: `0 8 24 rgba(28,26,20,0.12)`.

## 5. Mobile components

- **PillTabBar:**
  - A floating capsule 16 px above the safe area, white with a `line` border and soft shadow.
  - The active tab expands into a `brand-500` pill with icon and label in `ink-900`.
  - Inactive tabs show the icon only, in `ink-500`. The Cart badge is a `danger` dot with a count.
- **Header (Home):**
  - `brand-500` background with the logo wordmark, the delivery location line and a search field (white, radius 12).
  - Coins balance chip on the right.
- **ProductCard:** square image on `canvas`, wishlist heart top-right, 2-line name, rating chip (green with white star), then a price row: price, MRP strike, `% off` in green.
- **PriceDetails card:** a rows table ending with a dashed divider, the total in bold, and a green "You will save ₹X on this order" banner.
- **CouponCard:** `brand-100` background with a dashed `brand-600` border, the code in monospace caps and an "Apply" text button.
- **CoinBadge:** a small yellow coin icon with the number in `brand-700`.
- **LoginSheet:** a bottom sheet prompting guests ("Login to add items to your cart"), with Login (primary) and Sign up (outline) buttons.
- **Buttons:**

  | Variant | Fill | Text / border |
  |---|---|---|
  | primary | `brand-500` | `ink-900` text |
  | secondary | `ink-900` | white text |
  | outline | — | `line` border, `ink-900` text |
  | ghost | — | text only |
  | danger | — | — |

  Height is 48 on mobile and 40 on the admin.

## 6. Admin layout

- **Sidebar:**
  - 248 px wide, white with a right `line` border.
  - Logo block with a yellow square mark and the "Haat Admin" wordmark.
  - Nav items show an icon and label. The active item has a `brand-100` background, a `brand-600` left bar and `ink-900` text.
- **Top bar:** 64 px with the page title, a global search slot and the admin menu.
- **Content:** `canvas` background, max width 1280, 24 px padding.
- **Tables:** white card, sticky header in `ink-500` small caps, row hover `brand-50`, and right-aligned numeric columns with tabular numbers.
- **KPI StatCard:** label, big number, delta chip (green or red), and an optional sparkline in `brand-500`.
- **Charts:** revenue area chart with a `brand-500` stroke and `brand-100` fill, and ink axis labels.

## 7. Iconography and imagery

- Icons come from Lucide (`lucide-react` / `lucide-react-native`) at 1.75 stroke width.
- Product images sit on a `canvas` background with `contain` fit, so they are never cropped.
- Empty states use a simple line icon in a `brand-100` circle, a short title and one action.

## 8. Motion

- Press feedback: scale to 0.97, 120 ms.
- Pill tab change: the active pill width animates over 200 ms ease-out.
- Sheets slide up over 250 ms. There are no bouncy springs on content.
