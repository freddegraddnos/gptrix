export type IntakeQuestion = { id: string; text: string; type: "text" | "yesno"; required: boolean };
export type IntakeAnswer = { question: string; answer: string };

export function parseQuestions(raw: unknown): IntakeQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is IntakeQuestion => !!q && typeof q === "object" && typeof (q as IntakeQuestion).text === "string")
    .map((q) => ({ id: String(q.id), text: q.text, type: (q.type === "yesno" ? "yesno" : "text") as IntakeQuestion["type"], required: !!q.required }))
    .slice(0, 10);
}
