# 002: Home inventory

- **Status**: In progress
- **Owner**: @mrtrukiny
- **Created**: 2026-10-25

## Goal

Let the owner describe their home once: the rooms and the things in each room that need cleaning. This inventory is the input for AI task proposals (spec 003), so it has to be quick to fill in on the phone while walking around the house, and easy to correct later. See "Home inventory" in [`PRODUCT.md`](../PRODUCT.md#mvp-phase-1) and the **Home**, **Room**, and **Item** terms in the [glossary](../PRODUCT.md#glossary).

## User stories

- As the owner, I want to add the rooms of my home so that the app knows what spaces exist.
- As the owner, I want to list the items in each room (windows, shelves, sink...) with how many there are so that cleaning time can be estimated.
- As the owner, I want to fix names, counts, or notes, and remove things I added by mistake, so that the inventory matches my home.
- As the owner, I want to check my inventory without a connection so that I can see it anywhere, even if I can't change it until I'm back online.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I have no rooms, when I open the inventory, then I see an empty state that explains what rooms are and offers "Add room"; given a room has no items, when I open it, then I see an empty state that offers "Add item".
- [ ] AC2: Given I am on the inventory, when I add a room with a name, then it appears in the room list; when I rename it, the new name shows everywhere; the list shows each room's name and item count.
- [ ] AC3: Given I am in a room, when I add an item by choosing a type from the item type list, then the item is saved with that type, a name (defaulting to the type's label, editable), a count (default 1), and an optional note, and it appears in the room's item list.
- [ ] AC4: Given an existing item, when I edit its type, name, count, or note and save, then the item list shows the new values.
- [ ] AC5: Given a room or an item, when I choose "Delete", then I am asked to confirm, and the confirmation for a room says how many items will be deleted with it; cancelling changes nothing.
- [ ] AC6: Given a form, when I submit an empty name, a name over 60 characters, a count that is not a whole number from 1 to 99, a note over 200 characters, or a room name already used in my home, then the form is not saved and the field shows a specific message.
- [ ] AC7: Given I have opened the inventory before and I am now offline, when I open it, then I can see my rooms and items; the add, edit, and delete controls are disabled and a notice says changes need a connection. When the connection returns, the controls are enabled again without reloading.
- [ ] AC8: The inventory works at 360px wide and on desktop, in light and dark mode, using only the keyboard; forms and dialogs move focus correctly, and every control and list has an accessible name.

## UX notes

- **Structure:** a room list page and a room detail page with its items. On desktop the two can sit side by side; on mobile they are separate screens with a back link.
- **Adding items fast:** the item form opens with the type picker focused. Choosing a type fills in the name, so the common case is "pick type, adjust count, save". After saving, offer "Add another" to stay in the flow.
- **Item types** (fixed list for now, each with an icon): window, door, mirror, floor, rug, light fixture, shelf, desk, table, sofa, bed, closet, cabinet, countertop, appliance, sink, toilet, shower, bathtub, other. "Other" covers anything missing; custom types are out of scope.
- **Count:** a number stepper with a minimum of 1; the item list shows it, for example "Window x3".
- **Forms:** use a sheet on mobile and a dialog on desktop. Validation messages sit under the field and are linked to it for screen readers.
- **Loading:** skeleton rows while the list loads; save buttons show a busy state and can't be pressed twice.
- **Errors:** if a save fails, the form stays open with the entered values and shows a message with "Try again".
- **Offline:** same banner as the rest of the app, plus disabled controls with a visible reason. Nothing is queued.
- **Ordering:** rooms and items are listed in the order they were created.

## Out of scope

- AI suggestions of any kind (spec 003).
- Mapping the home from a video (phase 3).
- Size, material, or dirtiness attributes (phase 2).
- Editing while offline, or syncing queued changes.
- Reordering rooms or items, photos, and custom item types.
- More than one home per user.

## Open questions

- None. The item type list was confirmed by the owner.

---

## Technical plan

### Approach

Builds on spec 001 (Drizzle, Better Auth, `getCurrentUser()`).

- **Data model** (`src/db/schema/inventory.ts`):
  - `room` table: `id`, `userId`, `name`, `createdAt`, `updatedAt`. A unique index on `(user_id, lower(name))` enforces "no duplicate room names" case-insensitively.
  - `item` table: `id`, `userId`, `roomId` (cascade delete), `type`, `name`, `count`, `note`, `createdAt`, `updatedAt`.
  - There is no `home` table yet: with one home per user, the user is the home. A `home` table can be introduced with sharing (phase 3) without moving data, because every row already carries `userId`.
  - `type` is `text` validated against a TypeScript list, not a Postgres enum, so adding a type later doesn't need a migration.
- **Item types** live in `src/lib/inventory/item-types.ts`. Each entry has an id, an English label, and a lucide icon. The same list feeds the picker, validation, and (later) the AI prompt.
- **Validation:** Zod schemas in `src/lib/inventory/schemas.ts` are shared by the forms and the Server Actions. Limits: name 1 to 60 characters after trimming, count an integer from 1 to 99, note up to 200 characters. Duplicate room names are caught by the unique index and returned as a field error.
- **Reads** (`src/lib/inventory/queries.ts`): exported getters resolve the user with `getCurrentUser()`. They then call unexported `"use cache"` functions keyed by `userId` and tagged `inventory:<userId>`, following the Next.js Cache Components auth guide. A room that doesn't belong to the user is a `notFound()`.
- **Mutations** (`src/app/(app)/rooms/actions.ts`): `createRoom`, `renameRoom`, `deleteRoom`, `createItem`, `updateItem`, and `deleteItem`. Each re-reads the user, validates with Zod, scopes every query by `userId`, and calls `updateTag("inventory:<userId>")`. Each returns `{ ok: true } | { ok: false, fieldErrors, formError }` instead of throwing.
- **Routes:**
  - `/rooms` is the room list.
  - `/rooms/[roomId]` is the room detail.
  - The home page (`/`) gets a card linking to `/rooms` until the Today view (spec 006) takes it over. The header gets a "Rooms" link.
  - Pages are Server Components. Per-user data streams behind `<Suspense>` with skeleton rows (Cache Components forbids reading it in the static shell).
  - On desktop the room list and the detail sit side by side through a layout at `src/app/(app)/rooms/layout.tsx`. On mobile they are separate screens with a back link.
- **Client components** (leaves only): the room and item forms, the delete confirmation, and the count stepper. They use `useActionState` for pending and error states.
  - A `ResponsiveDialog` wrapper renders a shadcn `Sheet` below the `sm` breakpoint and a `Dialog` above it, using a small `useMediaQuery` hook.
  - "Add another" keeps the item form open and resets it with focus back on the type picker.
- **Offline (AC7):** an `InventoryEditGuard` client component wraps every edit control.
  - When `useOffline()` is true, it disables them and shows "Changes need a connection".
  - This matters because, with `experimental.useOffline`, Next would otherwise queue a Server Action and replay it on reconnect, and the spec says nothing is queued.
  - Reading offline relies on the service worker's existing runtime cache for pages and RSC payloads that were opened before.
  - T8 verifies this first with an e2e test. If the default cache doesn't cover `/rooms` RSC requests, T8 adds a `NetworkFirst` rule for `/rooms` in `src/app/sw.ts`. Sign-out already clears these caches.
- **New shadcn components:** `sheet`, `alert-dialog`, `select`, `label`, `textarea`, and `skeleton`. There are no new npm dependencies.

### Tasks

- [x] T1: Inventory schema, migration, and item types. Files: `src/db/schema/inventory.ts`, `src/db/schema/index.ts`, `drizzle/0001_inventory.sql`, `src/lib/inventory/item-types.ts`, `src/lib/inventory/item-types.test.ts`. Covers: AC3.
- [x] T2: Validation schemas and error mapping, including the duplicate-name database error. Files: `src/lib/inventory/schemas.ts`, `src/lib/inventory/schemas.test.ts`. Covers: AC6.
- [ ] T3: Cached, user-scoped queries: room list with item counts, and a room with its items. Files: `src/lib/inventory/queries.ts`. Covers: AC1, AC2, AC3.
- [ ] T4: Server Actions for rooms and items with typed results and tag invalidation. Files: `src/app/(app)/rooms/actions.ts`. Covers: AC2 to AC6.
- [ ] T5: UI building blocks: shadcn components, `ResponsiveDialog`, `useMediaQuery`, `CountStepper`, and `InventoryEditGuard`. Files: `src/components/ui/*` (generated), `src/components/responsive-dialog.tsx`, `src/hooks/use-media-query.ts`, `src/components/inventory/count-stepper.tsx`, `src/components/inventory/count-stepper.test.tsx`, `src/components/inventory/edit-guard.tsx`, `src/components/inventory/edit-guard.test.tsx`. Covers: AC6, AC7, AC8.
- [ ] T6: Room list: page, empty state, skeleton, add and rename form, and delete confirmation with the item count. Also the header link and the home card. Files: `src/app/(app)/rooms/layout.tsx`, `src/app/(app)/rooms/page.tsx`, `src/components/inventory/room-list.tsx`, `src/components/inventory/room-form.tsx`, `src/components/inventory/room-form.test.tsx`, `src/components/inventory/delete-confirm.tsx`, `src/components/app-shell.tsx`, `src/app/(app)/page.tsx`. Covers: AC1, AC2, AC5, AC6, AC8.
- [ ] T7: Room detail: item list ("Window x3"), add and edit item form with the type picker and "Add another", and item delete. Files: `src/app/(app)/rooms/[roomId]/page.tsx`, `src/components/inventory/item-list.tsx`, `src/components/inventory/item-form.tsx`, `src/components/inventory/item-form.test.tsx`. Covers: AC1, AC3, AC4, AC5, AC6, AC8.
- [ ] T8: Offline reading and disabled edits, verified end to end; add a service worker rule only if needed. Files: `e2e/inventory-offline.spec.ts`, `src/app/sw.ts` (only if needed). Covers: AC7.
- [ ] T9: E2E flows for the inventory, and docs (domain model in `ARCHITECTURE.md`, glossary note on item fields). Files: `e2e/inventory.spec.ts`, `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`. Covers: AC1 to AC6, AC8.

### Test plan

- Unit (Vitest):
  - Item type list: unique ids, every type has a label and icon (AC3).
  - Zod schemas at every boundary (empty, 60/61 characters, count 0/1/99/100/1.5, note 200/201), and mapping a unique violation to "A room with this name already exists" (AC6).
- Component (Testing Library):
  - Room form and item form: validation messages linked to fields with `aria-describedby`, busy submit, and "Add another" resetting with focus on the type picker (AC3, AC6, AC8).
  - Count stepper: keyboard and the min/max limits (AC3, AC6).
  - Edit guard: disabled with a reason when offline (AC7).
- E2E (Playwright, desktop and mobile, using the `signedInUser` fixture):
  - AC1: empty states for a new home and an empty room.
  - AC2: add and rename a room; the list shows the item count.
  - AC3 and AC4: add an item with the defaults, then edit every field.
  - AC5: delete a room with items after confirming; cancelling keeps it.
  - AC6: a duplicate room name and an invalid count show field messages.
  - AC7: after visiting, go offline, reload, and navigate between rooms; the data is visible and edit controls are disabled with the notice.
  - AC8: the add-room and add-item flows with the keyboard only, in dark mode.
- Data isolation: an e2e test with two signed-in users checks that one can't open the other's room URL (it shows a not-found page).
