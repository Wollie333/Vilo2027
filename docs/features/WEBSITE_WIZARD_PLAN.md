# Website Creation Wizard

## Summary
Replace the current simple `CreateWebsiteCard` (subdomain input only) with a streamlined multi-step wizard that takes hosts from "no website" to "live and accepting bookings" in under 2 minutes.

## Wizard Flow

| Step | Name | Description |
|------|------|-------------|
| 0 | Loading | Modal loads business context (logo, name, contact) |
| 1 | Basics | Site name, subdomain, logo, contact (prefilled, editable) |
| 2 | Theme | Preview & select from theme catalogue (live preview with host's logo/name) |
| 3 | Colors | 6 curated palettes per theme + "Custom" accent picker |
| 4 | Building | Animated sequence while system creates pages, rooms, auto-publishes |
| 5 | Done | Success message, redirect to Domain tab with prompt to connect domain |

---

## Files to Create

### 1. Wizard Components
```
apps/web/app/[locale]/dashboard/website/_wizard/
├── schemas.ts              # Zod schemas for wizard state
├── loadWizardContext.ts    # Server function: fetch business, themes, prefill
├── WebsiteWizard.tsx       # Main wizard modal (manages step state)
├── WizardThemePreview.tsx  # Live mini-preview with host's logo/colors
└── steps/
    ├── StepLoading.tsx     # Spinner while loading context
    ├── StepBasics.tsx      # Name, subdomain, logo, contact form
    ├── StepTheme.tsx       # Theme gallery with live previews
    ├── StepColors.tsx      # 6 palette cards + custom option
    ├── StepBuilding.tsx    # "Building your website..." animation
    └── StepDone.tsx        # Success + redirect CTAs
```

### 2. Palette Generation
```
apps/web/lib/site/palettes.ts
```
Generate 6 color variations per theme:
1. **Default** - Theme's original accent
2. **Warmer** - Hue shift +15° toward orange
3. **Cooler** - Hue shift -15° toward blue
4. **Bolder** - Saturation +20%
5. **Softer** - Saturation -20%, lightened
6. **Custom** - Opens accent color picker

### 3. Entry Point Button
```
apps/web/app/[locale]/dashboard/website/_components/CreateWebsiteButton.tsx
```
Replaces CreateWebsiteCard - button that opens the wizard modal.

---

## Files to Modify

### 1. `apps/web/app/[locale]/dashboard/website/actions.ts`
Add new action:
```typescript
export async function createWebsiteWithWizardAction(input: {
  businessId: string;
  subdomain: string;
  siteName: string;
  themeId: string;
  paletteIndex: number;
  customAccent?: string;
  logoPath?: string | null;
  contactEmail?: string;
  contactPhone?: string;
}): Promise<CreateResult>
```

This action:
- Validates input
- Loads selected theme bundle
- Creates `host_websites` row with brand + theme config
- Seeds pages from theme templates
- Syncs properties/rooms to website
- **Auto-publishes** (sets `status: 'published'`, builds snapshot)
- Returns website ID

### 2. `apps/web/app/[locale]/dashboard/website/page.tsx`
Replace `<CreateWebsiteCard>` with `<CreateWebsiteButton>` that opens the wizard.

### 3. `apps/web/messages/en.json`
Add wizard translations to `website` namespace.

---

## Component Details

### WebsiteWizard.tsx (Modal Shell)
- Full-screen on mobile, `max-w-3xl` on desktop
- Progress indicator (5 dots)
- Non-dismissible during building step
- Manages `WizardState` with React state

### StepBasics.tsx
- **Site name** - Text input, prefilled from `business.trading_name`
- **Subdomain** - DNS-safe input with `.vilo.site` suffix, live uniqueness check
- **Logo** - Display current (from business), upload button for new
- **Contact email** - Prefilled from user/business, optional
- **Contact phone** - Optional

### StepTheme.tsx
- Grid of theme cards from `loadActiveThemes()`
- Each card: preview image with host's logo overlaid, theme name, checkmark if selected
- Click to select

### StepColors.tsx
- 2x3 grid of palette cards
- Each shows: color swatches (bg, surface, accent, ink), name
- Card 6 = "Custom" opens hex picker for accent
- "Create Website" primary button

### StepBuilding.tsx
- Animated sequence with 4 messages:
  1. "Creating your website..."
  2. "Adding your pages..."
  3. "Connecting your rooms..."
  4. "Publishing to the web..."
- Calls `createWebsiteWithWizardAction`
- On error: shows message + "Try Again" button

### StepDone.tsx
- Success animation (checkmark)
- "Your website is live!" + subdomain URL
- "Connect Custom Domain" primary CTA → `/dashboard/website/[id]/domain`
- "Continue to Editor" secondary CTA

---

## Data Flow

```
┌─────────────────┐
│ CreateWebsite   │──▶ Opens WebsiteWizard modal
│ Button          │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ StepLoading     │──▶ loadWizardContext(businessId)
│                 │    Returns: business, host, themes, defaultSubdomain
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ StepBasics      │──▶ User edits prefilled name/subdomain/contact
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ StepTheme       │──▶ User selects theme from gallery
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ StepColors      │──▶ User picks palette (1-6) or custom accent
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ StepBuilding    │──▶ createWebsiteWithWizardAction(wizardState)
│                 │    Creates website + pages + rooms + publishes
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ StepDone        │──▶ router.push(`/dashboard/website/${id}/domain`)
└─────────────────┘
```

---

## Implementation Order

1. **Schemas & Types** - `_wizard/schemas.ts`, `lib/site/palettes.ts`
2. **Context Loader** - `loadWizardContext.ts`
3. **Server Action** - `createWebsiteWithWizardAction` in actions.ts
4. **Wizard Shell** - `WebsiteWizard.tsx` with step navigation
5. **Step Components** - In order: Loading → Basics → Theme → Colors → Building → Done
6. **Live Preview** - `WizardThemePreview.tsx`
7. **Entry Point** - `CreateWebsiteButton.tsx`, update `page.tsx`
8. **Translations** - Add to `en.json`

---

## Verification

### Build & Lint
```bash
cd apps/web && pnpm build && pnpm lint
```

### Manual Testing
1. Navigate to `/dashboard/website` with a business that has no website
2. Click "Create Website" button
3. Verify prefill works (name, logo, contact from business)
4. Select a theme, verify live preview shows host's logo
5. Pick a color palette, verify preview updates
6. Complete wizard, verify website is created and published
7. Verify redirect to domain tab
8. Visit the subdomain URL, confirm site is live

### Edge Cases
- Business with no logo → show placeholder, allow upload
- Subdomain already taken → show error, allow retry
- Network failure during build → show error + "Try Again"
- Mobile responsive → full-screen modal works correctly

---

## Design Decisions

### Why Auto-Publish?
The wizard is designed for speed. Hosts want to go from "nothing" to "live" immediately. Draft mode adds friction. They can always unpublish later from the editor.

### Why 6 Palettes Instead of Full Color Picker?
Most hosts aren't designers. Curated palettes ensure the result always looks good. The "Custom" option is there for those who want control, but it's just the accent color - the system auto-generates complementary colors.

### Why Live Preview with Host Data?
Seeing their own logo/name in the theme makes the choice feel real. It's the difference between "this theme looks nice" and "this is MY website".
