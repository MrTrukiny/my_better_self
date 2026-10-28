import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { REMINDER_KINDS } from "@/db/schema/notifications";
import { deliverReminder } from "@/lib/notifications/deliver";
import { isSignedByQStash } from "@/lib/notifications/qstash";

const messageSchema = z.object({
  userId: z.string().min(1),
  kind: z.enum(REMINDER_KINDS),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

/**
 * Receives a reminder queued in QStash at its time (ADR 0010). There is no signed-in user:
 * QStash's signature is the authorization, and the message names the owner.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!(await isSignedByQStash(request.headers.get("upstash-signature"), body))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  const parsed = messageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reminder" }, { status: 400 });
  }
  const { userId, ...message } = parsed.data;
  const result = await deliverReminder(userId, message);
  return NextResponse.json({ result });
}
