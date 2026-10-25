export type ActionState =
  | { status: "idle" }
  | { status: "success"; id?: string }
  | {
      status: "error";
      fieldErrors?: Record<string, string | undefined>;
      formError?: string;
      /** The submitted values, so the form can keep what the user typed. */
      values?: Record<string, string>;
    };

export const IDLE: ActionState = { status: "idle" };
