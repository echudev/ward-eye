export type Provider = "groq" | "gemini";

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "groq", label: "Groq · gpt-oss-120b" },
  { id: "gemini", label: "Google AI Studio · Gemini 3.5 Flash" },
];
