# Design Guidelines

This project strictly follows a Shopifi-inspired design system optimized for transactional dashboard applications.

**For a comprehensive and mandatory list of design tokens, refer to `Design.md` at the project root.**

## Quick Reference Rules

### 1. Colors & Surfaces
- **Canvas (Background):** Strictly `#ffffff` (light) or `#fbfbf5` (cream). Do not use third canvas colors, greys, or beiges.
- **Ink (Text):** `#000000` on light canvases.
- **Primary Accents:** Aloe (`#c1fbd4`) and Pistachio (`#d4f9e0`) are surface fills only, NEVER text colors.

### 2. Typography
- **Body:** Inter Variable (16px/420 weight for body, 550 for strong).
- **Heading:** Neue Haas Grotesk Display (thin weights 330–500). NEVER use weight 400+ for display tiers.
- **Font Settings:** `"ss03"` must be enabled globally.

### 3. Components
- **Buttons:** MUST be pill-shaped (`rounded-full` / 9999px). No rounded rectangles.
- **Primary CTA:** Filled black pill with white text.
- **Modals/Popups:** Avoid native browser `window.confirm` or `alert`. Use custom backdrop modals matching the application aesthetic.

### 4. Spacing & Elevation
- **Spacing Scale:** 2/4/8/12/16/24/32/64px
- **Radius Scale:** xs=4px, sm=5px, md=8px, lg=12px, xl=20px, pill=9999px
- **Elevation:** Level 3 stacked tiny shadows on light surfaces. Avoid drop shadows on dark cards.
