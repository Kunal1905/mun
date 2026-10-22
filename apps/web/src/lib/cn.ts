export { clsx as cn } from "clsx";

export const CATEGORY_LABELS: Record<string, string> = {
  security: "Security",
  climate: "Climate",
  economy: "Economy",
  health: "Health",
  technology: "Technology",
  "human-rights": "Human rights",
  migration: "Migration",
  custom: "Custom",
};

export const categoryLabel = (c: string | null | undefined) => (c ? (CATEGORY_LABELS[c] ?? c) : "Any topic");
