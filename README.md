# CampusCare

React Native mobile app built with **Expo Router**, **HeroUI Native**, **Tamagui**, and **Supabase**.

## Architecture

```
app/                          # Expo Router file-based routing
  (auth)/                     # Auth screens (login, signup)
  (tabs)/                     # Bottom tab navigator (home, appointments, profile, etc.)
  (settings)/                 # Settings & info screens (about, privacy, terms, etc.)
  discipline-office/          # Discipline Office feature screens
  health-service/             # Health Service feature screens
  student-development-affairs/# SDA feature screens
  referrals/                  # Referrals feature screens

components/
  ui/                         # Shared UI primitives (TextLinkButton, GradientText, UnderlineTabs, FileUploadDropzoneCard, etc.)
  layout/                     # Screen shell components (ScreenNavbar, Container, etc.)
  icons/                      # Iconsax SVG icon components
    filled/                   # New filled icons go here
    outline/                  # New outline icons go here
    tabs/                     # New tab bar icons go here
  home/                       # Home screen components
  health-service/             # Health Service components
  discipline-office/          # Discipline Office components
  student-development-affairs/# SDA components
  auth/                       # Auth flow components
  notifications/              # Notification components

lib/
  auth/                       # Auth provider & session logic
  health-service/             # Health service domain logic, API, types, store
  hooks/                      # Shared custom hooks
  notifications/              # Notification utilities
  store/                      # Zustand global store
  ui/                         # Global design tokens & screen gradients
    theme.ts                  # SCHEDULE_PARTNER & shared tokens
    screenGradients.ts        # Background gradient presets
  routes.ts                   # Centralized route path constants
  supabase.ts                 # Supabase client singleton
```

## Conventions

- **Feature-based grouping**: Co-locate components, logic, and types per feature.
- **Route groups `()`**: Used for organization only — don't affect URLs.
- **Re-export stubs**: Some `components/` root files are deprecated re-exports pointing to `ui/` or `layout/`. Prefer the new paths in new code.
- **Theme tokens**: Import `SCHEDULE_PARTNER` from `@/lib/ui/theme` (not the health-service-specific file).
- **Route constants**: Use `ROUTES` from `@/lib/routes` instead of hard-coded strings when possible.
- **Icons**: Place new icons in `icons/filled/`, `icons/outline/`, or `icons/tabs/`. Existing icons remain at `icons/` root during migration.

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React Native + Expo SDK |
| Routing | Expo Router (file-based) |
| UI Kit | HeroUI Native, Tamagui |
| Styling | Uniwind (Tailwind for RN) |
| State | Zustand |
| Backend | Supabase (auth, database) |
| Animations | react-native-reanimated |
| Icons | Custom Iconsax SVG components |
