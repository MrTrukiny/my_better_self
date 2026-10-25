# 002: Home inventory

- **Status**: Draft
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
- **Item types** (fixed list for now, each with an icon): window, mirror, shelf, desk, table, closet, floor, toilet, sink, shower, countertop, appliance, other.
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

- Is the starting item type list right? Add, remove, or rename types before approval. "Other" covers anything missing.

---

## Technical plan

_Filled in by the `plan-feature` skill after the spec is approved._

### Approach

Short description of the design and any trade-offs. Link to an ADR if a significant decision was made.

### Tasks

- [ ] T1: _description_. Files: `path/to/file.ts`. Covers: AC1.
- [ ] T2: ...

### Test plan

- Unit: ...
- E2E: ...
