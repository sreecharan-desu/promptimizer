import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import type { TaskType } from "./optimizer/types";

/**
 * Server-side semantic classification via TypeSafe JEV.
 * TYPESAFE_API_KEY is read only here. Never prefix it with NEXT_PUBLIC_.
 */

const TASK_TYPES = [
  "factual_qa",
  "summarization",
  "extraction",
  "coding",
  "debugging",
  "reasoning",
  "long_context",
  "vision",
  "general",
] as const satisfies readonly TaskType[];

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type JevDifficulty = (typeof DIFFICULTIES)[number];

export type JevRequestClassification = {
  taskType: TaskType;
  difficulty: JevDifficulty;
  taskTypeConfidence: number;
  difficultyConfidence: number;
  available: boolean;
};

let client: TypeSafeClient | null = null;

function apiKey(): string {
  return process.env.TYPESAFE_API_KEY?.trim() ?? "";
}

function jevClient(): TypeSafeClient | null {
  const key = apiKey();
  if (!key) return null;
  if (!client) {
    client = new TypeSafeClient({
      apiKey: key,
      timeout: 3_000,
      logLevel: "off",
      // One attempt. Failures fall back to local heuristics — no retry storm.
      retry: { maxRetries: 0 },
    });
  }
  return client;
}

function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

function isDifficulty(value: string): value is JevDifficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

function confidenceOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function publicError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : "request failed";
  const key = apiKey();
  const redacted = key ? raw.split(key).join("[redacted]") : raw;
  return redacted.slice(0, 180);
}

/** One System One call for task type and difficulty. Returns null on any failure. */
export async function classifyRequestWithJev(userQuery: string): Promise<JevRequestClassification | null> {
  const jev = jevClient();
  if (!jev) return null;
  const query = userQuery.trim();
  if (!query) return null;

  try {
    const response = await jev.systemOne({
      state: { user_query: query.slice(0, 12_000) },
      questions: {
        task_type: choice("What is the primary task the user is asking the LLM to perform?", {
          factual_qa: "A short factual question with a known answer.",
          summarization: "Condense, recap, or shorten existing text.",
          extraction: "Pull specific fields, entities, or structured data out of text.",
          coding: "Write, edit, or explain code, SQL, or configuration.",
          debugging: "Find, explain, or fix a bug, error, race, or stack trace.",
          reasoning: "Multi-step logic, proofs, math, or planning that must be worked through.",
          long_context: "The request is dominated by a very long document the model must read.",
          vision: "The request depends on understanding an image.",
          general: "None of the other tasks is clearly primary.",
        }),
        difficulty: choice("How difficult is this request for a capable LLM to solve correctly?", {
          easy: "A capable model should answer this reliably. Cheaper models are appropriate.",
          medium: "Needs a competent model, but not the strongest available.",
          hard: "Easy to get wrong: multi-step, ambiguous, or high-stakes. Needs a stronger model, not necessarily the most expensive.",
        }),
      },
    });

    const task = response.answers.task_type;
    const difficulty = response.answers.difficulty;
    const taskChoice = String(task?.choice ?? "");
    const difficultyChoice = String(difficulty?.choice ?? "");
    const taskConfidence = confidenceOf(task?.confidence);
    const difficultyConfidence = confidenceOf(difficulty?.confidence);
    if (!isTaskType(taskChoice) || !isDifficulty(difficultyChoice) || taskConfidence == null || difficultyConfidence == null) {
      console.warn("[jev] unexpected answer; using local classifier");
      return null;
    }

    return {
      taskType: taskChoice,
      difficulty: difficultyChoice,
      taskTypeConfidence: taskConfidence,
      difficultyConfidence: difficultyConfidence,
      available: true,
    };
  } catch (error) {
    console.warn(`[jev] classification failed; using local classifier (${publicError(error)})`);
    return null;
  }
}
