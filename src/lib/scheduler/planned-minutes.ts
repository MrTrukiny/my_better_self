import { sql } from "drizzle-orm";
import { occurrence, task } from "@/db/schema";

/** An occurrence's minutes: as planned, or the task's for rows planned before ADR 0009. */
export const plannedMinutes = sql<number>`coalesce(${occurrence.plannedMinutes}, ${task.minutes})`;
