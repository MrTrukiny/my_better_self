import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getEnv } from "@/lib/env";

/** How `proposeTasks` should run here: the fake in tests, Gemini when a key is set, or not at all. */
export function getProposalOptions(): { model?: LanguageModel | null; fake?: boolean } {
  const env = getEnv();
  if (env.AI_FAKE) {
    return { fake: true };
  }
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  return { model: apiKey ? createGoogleGenerativeAI({ apiKey })(env.AI_MODEL) : null };
}
