# Scholarship List — Complete Design Specifications

From Figma node `1526:4088`

## Page Structure

### Background
- **Color**: `#fdfdfd` (light gray/off-white)
- **Border Radius**: `40px` (top corners)
- **Padding**: `pt-[55px] pb-[715px]`
- **Gap**: `20px` between sections

---

## Header Section (Back Button + Title/Subtitle)

### Container
- **Layout**: Row flex with `16px` gap
- **Alignment**: `items-center justify-center`
- **Padding**: none (full width)

### Back Button (Left)
- **Size**: `44px × 44px`
- **Styling**: Icon frame (image asset)

### Title + Subtitle (Right)
- **Width**: `344px`
- **Layout**: Flex col with `4px` gap

#### Title: "Scholarship List"
- **Font**: `Inter Semi Bold`
- **Size**: `24px`
- **Weight**: `600` (semibold)
- **Color**: `#000000` (black)
- **Line Height**: `normal`
- **Letter Spacing**: `-0.48px` (tight)
- **Leading**: 0

#### Subtitle (2 lines)
- **Font**: `Inter Light`
- **Size**: `14px`
- **Weight**: `300` (light)
- **Color**: `#535862` (gray-600)
- **Line Height**: `0` (see paragraphs below)
- **Letter Spacing**: `-0.28px`

> Text: "Reports are reviewed fairly. You can track your case and sanctions here."

Each paragraph:
- **Line Height**: `normal`
- **Margin**: `0` (no gap between lines)

---

## Search Bar

### Container
- **Background**: `white`
- **Border**: none (but has shadow)
- **Border Radius**: `24px`
- **Padding**: `py-[12px] px-[16px]` (12px top/bottom, 16px left/right)
- **Shadow**: `0px 3px 4.7px 0px rgba(0,0,0,0.04)`
- **Layout**: Row flex with `16px` gap, `items-center`
- **Gap**: `16px` (between left search icon, text input, sort button)

#### Left Search Icon
- **Size**: `18px × 18px`

#### Input Text (Center)
- **Font**: `Instrument Sans Regular`
- **Size**: `14px`
- **Weight**: `400` (normal)
- **Color**: `#8f9098` (placeholder gray)
- **Line Height**: `20px`
- **Font Variation**: `wdth 100`
- **Flex**: `flex-1`

#### Right Sort/Filter Button
- **Width**: `28px`
- **Height**: `24px`
- **Border Radius**: `14px`

---

## Scholarship Card (List Item)

### Outer Container (Sticky wrapper)
- **Background**: `#fafafa` (gray-50)
- **Padding**: `pt-[4px] pb-[12px] px-[4px]`
- **Border Radius**: `16px`
- **Width**: `398px`
- **Gap**: `8px` (internal flex col)

### Inner Card (Main content area)
- **Background**: `white`
- **Border**: `1px solid #f5f5f5` (gray-100)
- **Border Radius**: `16px`
- **Padding**: `px-[16px] py-[12px]`
- **Layout**: Flex col with `20px` gap

#### Top Section: Title + Slots Count

**Container**:
- **Layout**: Row flex, `items-center justify-between`
- **Width**: full

**Left (Icon + Title + Metadata)**:
- **Gap**: `4px`
- **Layout**: Row flex

**Icon**:
- **Size**: `40px × 40px`
- **Border Radius**: `999px` (full circle)
- **Overflow**: clip

**Title Group**:
- **Layout**: Flex col, `gap-[4px]`

**Title: "White Scholarship"**
- **Font**: `Inter Medium`
- **Size**: `16px`
- **Weight**: `500` (medium)
- **Color**: `#181d27` (gray-900)
- **Line Height**: `normal`
- **Letter Spacing**: `-0.32px`

**Subtitle: "AY 2025 - 2026 · 1st Term"**
- **Font**: `Inter Regular`
- **Size**: `14px`
- **Weight**: `400` (normal)
- **Color**: `#717680` (gray-500)
- **Line Height**: `normal`
- **Letter Spacing**: `-0.28px`
- **Layout**: Row flex, wrapping, with bullet point separator

**Right (Slots Count)**:
- **Layout**: Row flex, `gap-[2px]`, `items-end`
- **Whitespace**: nowrap

**Number (e.g., "15")**:
- **Font**: `Inter Regular`
- **Size**: `20px`
- **Weight**: `400` (normal)
- **Color**: `#252b37` (gray-800)
- **Letter Spacing**: `-2.4px`

**Unit (e.g., "/slots")**:
- **Font**: `Inter Regular`
- **Size**: `16px`
- **Weight**: `400` (normal)
- **Color**: `#717680` (gray-500)
- **Letter Spacing**: `-0.64px`

---

#### Middle Section: Badge Chips (100% Tuition Fee, Min GPA: 2.5)

**Container**:
- **Layout**: Row flex, `items-center justify-between`
- **Width**: `239px`

**Each Badge/Chip**:
- **Background**: `white`
- **Border**: `1px solid #f5f5f5` (gray-100)
- **Border Radius**: `12px`
- **Padding**: `px-[12px] py-[4px]`
- **Layout**: Row flex, `gap-[6px]`, `items-center`

**Badge Icon** (if present):
- **Size**: `16px × 16px`

**Badge Text**:
- **Font**: `Inter Medium`
- **Size**: `12px`
- **Weight**: `500` (medium)
- **Color**: `#252b37` (gray-800)
- **Line Height**: `16px`
- **Letter Spacing**: `-0.24px`

**Min GPA badge (right)**:
- **Layout**: Row flex, centered
- **Label "Min GPA:"**: `color: #717680` (gray-500)
- **Value "2.5"**: `color: #252b37` (gray-800)

---

#### Bottom Section: Meta Info + Status Pill

**Container**:
- **Layout**: Row flex, `items-center justify-between`
- **Padding**: `px-[12px]`

**Left Meta (Closes date + Applications count)**:
- **Layout**: Row flex, `gap-[12px]`
- **Width**: `211px`

**Each Meta Item**:
- **Layout**: Row flex, `gap-[4px]`

**Meta Icon**:
- **Size**: `16px × 16px`

**Meta Text**:
- **Font**: `Inter Regular`
- **Size**: `12px`
- **Weight**: `400` (normal)
- **Color**: `#717680` (gray-500)
- **Line Height**: `normal`
- **Letter Spacing**: `-0.48px`
- **Whitespace**: nowrap

> Examples:
> - "Closes May 15"
> - "58 application"

**Status Pill** (Right):
- **Layout**: Row flex, `items-center justify-center`
- **Padding**: `px-[12px] py-[8px]`
- **Border Radius**: `12px`

**Status Pill Colors & Text**:

| Status | Background | Text Color | Text |
|--------|------------|------------|------|
| Closing Soon | `#fef3f2` (error-50) | `#f04438` (error-500) | "Closing Soon" |
| Limited Slots | (info/blue variant) | (info-500 blue) | "Limited Slots" |
| High Demand | (warning/orange variant) | (warning-500 orange) | "High Demand" |

**Status Pill Text**:
- **Font**: `Inter Medium`
- **Size**: `12px`
- **Weight**: `500` (medium)
- **Line Height**: `16px`
- **Letter Spacing**: `-0.24px`
- **Whitespace**: nowrap

---

## Color Palette (from Figma design tokens)

### Backgrounds
- Page/Surface: `#fdfdfd` (off-white)
- Card Background: `#ffffff` (white)
- Secondary Surface: `#fafafa` (gray-50)
- Search/Inputs: `#ffffff`

### Text
- **Primary (dark headings)**: `#181d27` (gray-900)
- **Secondary (subtext)**: `#717680` (gray-500)
- **Tertiary (disabled/muted)**: `#8f9098` (gray-600)
- **Dark Accent**: `#252b37` (gray-800)
- **Black**: `#000000`

### Borders
- **Default**: `#f5f5f5` (gray-100)
- **Input/Search**: `rgba(0,0,0,0.05)` (shadow, not solid)

### Status Badges
- **Error (Closing Soon)**: `#fef3f2` background, `#f04438` text
- **Info (Limited Slots)**: (determine from secondary cards)
- **Warning (High Demand)**: (determine from secondary cards)

### Shadows
- Search Bar: `0px 3px 4.7px 0px rgba(0,0,0,0.04)` (subtle drop shadow)

---

## Typography Summary

| Component | Font | Size | Weight | Color | Letter Spacing |
|-----------|------|------|--------|-------|-----------------|
| Page Title | Inter Semi Bold | 24px | 600 | #000000 | -0.48px |
| Subtitle | Inter Light | 14px | 300 | #535862 | -0.28px |
| Card Title | Inter Medium | 16px | 500 | #181d27 | -0.32px |
| Card Meta | Inter Regular | 14px | 400 | #717680 | -0.28px |
| Slots Count (number) | Inter Regular | 20px | 400 | #252b37 | -2.4px |
| Slots Count (unit) | Inter Regular | 16px | 400 | #717680 | -0.64px |
| Badge Text | Inter Medium | 12px | 500 | #252b37 | -0.24px |
| Meta Text | Inter Regular | 12px | 400 | #717680 | -0.48px |
| Status Pill | Inter Medium | 12px | 500 | varies | -0.24px |
| Search Placeholder | Instrument Sans | 14px | 400 | #8f9098 | – |

---

## Layout Spacing

| Element | Value |
|---------|-------|
| Page top padding | 55px |
| Page gap (sections) | 20px |
| Header gap | 16px |
| Search bar padding | 12px (top/bottom), 16px (left/right) |
| Search bar gap | 16px |
| Card outer padding | 4px (sides), 12px (bottom), 4px (top) |
| Card padding | 16px (left/right), 12px (top/bottom) |
| Card gap | 20px (internal sections) |
| Badge/chip gap | 6px (internal) |
| Badge/chip padding | 12px (left/right), 4px (top/bottom) |
| Status pill padding | 12px (left/right), 8px (top/bottom) |

---

## Border Radius

| Component | Radius |
|-----------|--------|
| Page container | 40px |
| Search bar | 24px |
| Card outer | 16px |
| Card inner | 16px |
| Badge/chip | 12px |
| Status pill | 12px |
| Icon containers | 999px (circular) or 14px |

---

## Key Implementation Notes

1. **Card is a scrollable list item** — each card sits in a `FlatList` or `ScrollView`
2. **Status pills are conditional** — show based on:
   - Remaining slots count
   - Days until application close date
   - Application count (if high demand)
3. **Chips (badges) are static** — "100% Tuition Fee" and "Min GPA: 2.5" are always visible
4. **Icons are SVG/image assets** from Figma (search, sort, medal, calendar, users, etc.)
5. **Font weights in React Native** — use `fontWeight: 'bold'` for `600`, `'500'` for medium, `'300'` for light, or rely on `fontFamily` if fonts are pre-loaded as separate weights
