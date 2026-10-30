import type { AnswerStatus, QuerySource } from "../../api/query.api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: QuerySource[];
  createdAt?: string;
  /** Loaded from history: the API doesn't persist sources with messages. */
  fromHistory?: boolean;
  /** Animate on first render only for messages created in this session. */
  fresh?: boolean;
  /** Server id of an assistant answer (used for 👍 / 👎 feedback). */
  serverId?: string;
  status?: AnswerStatus | null;
  feedback?: "up" | "down" | null;
  /** True while tokens are still arriving. */
  streaming?: boolean;
}

/** The backend's fixed reply when retrieval finds nothing relevant. */
export const NOT_FOUND_PREFIX = "I cannot answer this question";

export const isNotFoundAnswer = (content: string): boolean =>
  content.trim().startsWith(NOT_FOUND_PREFIX);

export const getSourceFilename = (source: QuerySource): string => {
  const name = source.filename ?? source.file_name ?? source.document_name ?? source.name;
  return typeof name === "string" && name.trim() ? name.trim() : "Untitled document";
};

export const getSourcePage = (source: QuerySource): string | null => {
  const meta = source.metadata as Record<string, unknown> | undefined;
  const candidates = [source.page, source.page_number, source.pageNumber, meta?.page, meta?.page_number];
  for (const value of candidates) {
    if (typeof value === "number") return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (typeof source.sheet === "string" && source.sheet.trim()) return `sheet ${source.sheet.trim()}`;
  return null;
};

export const getSourceSnippet = (source: QuerySource): string | null => {
  if (typeof source.excerpt === "string" && source.excerpt.trim()) return source.excerpt.trim();
  if (typeof source.content === "string" && source.content.trim()) return source.content.trim();
  const meta = source.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.snippet === "string") return meta.snippet.trim();
  return null;
};
