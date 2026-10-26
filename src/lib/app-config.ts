export const APP_NAME = "My Better Self";
export const APP_SHORT_NAME = "Better Self";
export const APP_DESCRIPTION =
  "Plan household cleaning with AI in daily 45-minute sessions synced to your calendar.";
/** Default daily cleaning budget. A single cleaning task is capped lower, so a session holds several. */
export const DAILY_CLEANING_MINUTES = 45;
export const THEME_COLOR = "#171717";

const DAY_IN_SECONDS = 60 * 60 * 24;
/** Better Auth session lifetime, and how often an active session's expiry is pushed back. */
export const SESSION_OPTIONS = { expiresIn: 30 * DAY_IN_SECONDS, updateAge: DAY_IN_SECONDS };
