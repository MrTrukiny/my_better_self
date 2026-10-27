import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_NAME } from "@/lib/app-config";

export const metadata: Metadata = {
  title: "Privacy policy",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        {APP_NAME} is a personal app that plans household cleaning. Only accounts on its owner's
        allowlist can sign in.
      </p>

      <h2>What it stores</h2>
      <ul>
        <li>Your Google name, email address, and profile picture, from signing in.</li>
        <li>The rooms and items you add, the cleaning tasks you accept, and your schedule.</li>
        <li>Which tasks you mark as done or skipped.</li>
        <li>
          If you connect Google Calendar: the id of the calendar it created, and the id and a
          fingerprint of each event it wrote, to skip unchanged days.
        </li>
      </ul>

      <h2>Google Calendar</h2>
      <p>When you connect Google Calendar, the app asks for three permissions and uses them to:</p>
      <ul>
        <li>Create a "Cleaning" calendar and add, change, or remove its own events in it.</li>
        <li>List your calendars, to know which ones to check for conflicts.</li>
        <li>
          Read when you are busy or free, to warn you when a cleaning session overlaps something
          else. It never reads the titles or details of your other events.
        </li>
      </ul>
      <p>
        {APP_NAME}'s use and transfer of information received from Google APIs adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="underline underline-offset-4"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>Vercel hosts the app, and Neon hosts its database.</li>
        <li>
          Google Gemini receives the names of your rooms and items when you ask for task proposals.
          No calendar data is sent to it.
        </li>
      </ul>
      <p>Your data is not sold, shared for advertising, or used for anything but the app itself.</p>

      <h2>Removing your data</h2>
      <p>
        Disconnecting Google Calendar from the Schedule page deletes the "Cleaning" calendar and
        revokes the app's access. You can also revoke it at any time from your Google Account's
        security settings. To delete everything else, ask the app's owner, who will remove your
        account and all its data.
      </p>
    </LegalPage>
  );
}
