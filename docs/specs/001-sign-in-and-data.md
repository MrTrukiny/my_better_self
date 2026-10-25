# 001: Sign-in and data

- **Status**: Approved
- **Owner**: @mrtrukiny
- **Created**: 2026-10-25

## Goal

Give the app an owner and a place to keep data. Every later feature (inventory, tasks, sessions) stores personal records and later needs Google access for the calendar, so the app must first know who is using it and keep that person's data in a database. Only the owner can get in; anyone else is turned away. See the target user and the "single owner" constraint in [`PRODUCT.md`](../PRODUCT.md#target-user), and ADR [0004](../decisions/0004-data-auth-hosting.md).

## User stories

- As the owner, I want to sign in with my Google account so that I don't need another password.
- As the owner, I want everyone else to be refused so that my home data stays private.
- As the owner, I want to stay signed in on my phone so that opening the installed app takes me straight in.
- As the owner, I want to sign out so that I can leave a shared or borrowed device safely.

## Acceptance criteria

Each criterion is testable and maps to at least one test.

- [ ] AC1: Given I am signed out, when I open any app page, then I am taken to the sign-in screen, and after signing in I land on the page I first asked for.
- [ ] AC2: Given my Google email is on the allowlist, when I choose "Continue with Google" and approve, then I land in the app and see my name or avatar in the app header.
- [ ] AC3: Given a Google email that is not on the allowlist, when that account completes Google sign-in, then no session is created and the sign-in screen shows "This account doesn't have access."
- [ ] AC4: Given I am signed in, when I close and reopen the app (browser or installed PWA) within the session lifetime, then I am still signed in.
- [ ] AC5: Given I am signed in, when I choose "Sign out" from the account menu, then my session ends and I am back on the sign-in screen; pressing Back does not show app content.
- [ ] AC6: Given sign-in is in progress, when I wait, then the button shows a busy state and cannot be pressed twice; given Google returns an error or I cancel, then I see a short message and can try again.
- [ ] AC7: Given I am offline on the sign-in screen, when I look at it, then the Google button is disabled and a message says a connection is needed to sign in.
- [ ] AC8: The sign-in screen and the account menu work at 360px wide and on desktop, in light and dark mode, using only the keyboard, and their controls have accessible names.

## UX notes

- **Sign-in screen:** app name and icon, one-line description, and a single "Continue with Google" button. Centered on both mobile and desktop; no other navigation.
- **Account menu:** avatar button in the app header that opens a menu with the account email and "Sign out". On mobile it sits at the top right, inside the safe area.
- **Loading:** the button shows a spinner and "Signing in..." while the Google redirect is in flight.
- **Errors:** inline message under the button, announced to screen readers (`role="alert"` or a polite live region). The access-denied message does not reveal the allowlist.
- **Offline:** reuse the existing offline banner; the button is disabled with a visible reason, not just greyed out.
- **Focus:** on load, focus starts on the Google button; after an error, focus moves to the message.

## Out of scope

- Google Calendar scopes and tokens. Sign-in asks only for basic profile access; calendar access is requested in spec 005.
- Multiple users, invitations, or household sharing.
- Sign-in methods other than Google (email, passkeys, other providers).
- An admin screen to edit the allowlist; it is configured by the owner in the deployment settings.
- Any domain data (rooms, items). Those tables arrive with spec 002.

## Open questions

- None.

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
