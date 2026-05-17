# Scholarship List redesign plan

## Goal
Implement the Figma Scholarship List screen (node `1526:4088`) in the Expo Router app, using React Native best practices (virtualized list, clean component boundaries, resilient loading/error/empty states).

Design reference:
- Figma: https://www.figma.com/design/fohEYNS3NvLGLSbcbeZtuM/CampusCare---Mobile-UI---UX?node-id=1526-4088&m=dev
- Screenshot provided in chat (Scholarship List)

## Current code touchpoints
- Screen: `app\\student-development-affairs\\index.tsx` (currently renders list via `ScrollView` + map)
- Detail screen: `app\\student-development-affairs\\about-scholarship.tsx`
- Store/API: `lib\\scholarships\\scholarshipStore.ts`, `lib\\scholarships\\scholarshipApi.ts`
- Existing UI pieces: `components\\student-development-affairs\\ScholarshipSearchBar.tsx`, `ScholarshipCard.tsx`

## Proposed approach
1) **Extract UI spec from Figma**
   - Header: back button, title, subtitle
   - Search bar: left search icon + right filter icon
   - List item card: icon, title, AY/term, slots count, chip row (discount, min GPA), meta row (close date, applications), right-side status pill.

2) **Refactor list to FlatList**
   - Replace `ScrollView` + `map` with `FlatList` for virtualization.
   - Use `ListHeaderComponent` for header + search.
   - Use `keyExtractor`, `renderItem` memoization, stable callbacks.

3) **Build new UI components (reusable)**
   - `ScholarshipListItemCard` (new) matching Figma layout.
   - Small atoms: `StatusPill`, `InfoChip`, `MetaRow` (only if needed).
   - Reuse existing icons where possible.

4) **Data mapping + badge logic**
   - Slots: compute `remaining = totalSlots - filledSlots` and display `${remaining}/slots`.
   - Discount/min GPA: show from `ScholarshipProgram`.
   - Status pill rules (configurable):
     - `Closing Soon`: close date within N days
     - `Limited Slots`: remaining <= threshold
     - `High Demand`: requires an applications count signal

5) **UX states & a11y**
   - Loading: skeleton cards (or existing indicator if no skeleton component yet).
   - Empty: Figma-aligned empty state copy.
   - Error: retry button.
   - Accessibility labels/roles for back, filter, each card CTA.

6) **QA / verification**
   - iOS/Android layout parity, safe-area padding, font scaling.
   - Performance: scrolling smooth, no re-render storms.

## Open decisions (need confirmation)
- ✅ Show **applications count** (“58 application”). Implementation plan: extend `getPrograms()` to also select a related aggregate count from `scholarship_applications` via FK relationship (PostgREST nested `count`), ideally counting **non-draft** applications to reflect “real” submissions. If nested count isn’t available in this project’s PostgREST config, add a SQL view/RPC that returns `program_id, application_count` and join client-side.
- Should the **subtitle text** match Figma exactly (even if copy feels reused), or should we update the copy to scholarship-specific messaging?

## Acceptance criteria
- Scholarship List matches Figma spacing/typography/colors closely.
- Uses `FlatList` (virtualized), not `ScrollView` mapping.
- Correct loading/error/empty states.
- Badges/pills are deterministic and unit-testable logic (even without adding a new test framework).
