import { useEffect, useRef } from "react";
import type { Plan } from "../shared/flow";
import { calendar, download } from "./exports";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function usePlanTools(plan: Plan | null) {
  const current = useRef(plan);
  current.current = plan;
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifetime = new AbortController();
    const inputSchema = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    const validate = (input: unknown) => {
      if (
        typeof input !== "object" ||
        input === null ||
        Array.isArray(input) ||
        Object.keys(input).length
      )
        throw new Error("Expected an empty object");
    };
    const tools: Tool[] = [
      {
        name: "read_confirmed_date_plan",
        title: "Read confirmed date plan",
        description:
          "Read the exact confirmed activity, local date, time, place and closing. Returns incomplete until the recipient confirms a plan.",
        inputSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          validate(input);
          return current.current
            ? { status: "ok", plan: current.current }
            : { status: "incomplete" };
        },
      },
      {
        name: "download_confirmed_date_calendar",
        title: "Save confirmed date to calendar",
        description:
          "Download an ICS calendar file for the already confirmed plan. Does not create or change a plan and cannot bypass Heart Sweeper.",
        inputSchema,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          validate(input);
          if (!current.current)
            throw new Error("Complete the invitation before saving a calendar");
          download(
            new Blob([calendar(current.current)], {
              type: "text/calendar;charset=utf-8",
            }),
            "our-date.ics",
          );
          return { status: "ok", filename: "our-date.ics" };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifetime.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => lifetime.abort();
  }, []);
}
