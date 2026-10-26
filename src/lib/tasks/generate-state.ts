export type GenerateState =
  | { status: "idle" }
  | { status: "success"; count: number }
  | { status: "error"; formError: string };

export const GENERATE_IDLE: GenerateState = { status: "idle" };
