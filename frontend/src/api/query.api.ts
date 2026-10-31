import apiClient from "./axios";
import { API_BASE_URL, getAccessToken, redirectToLogin, refreshSession } from "./tokens";

export interface QuerySource {
  ref?: number;
  filename?: string;
  file_name?: string;
  document_name?: string;
  name?: string;
  page?: number | string | null;
  page_number?: number | string | null;
  pageNumber?: number | string | null;
  sheet?: string | null;
  excerpt?: string;
  score?: number;
  content?: string;
  metadata?: Record<string, unknown>;
  chunk_index?: number;
  document_id?: string;
  [key: string]: unknown;
}

export type AnswerStatus = "answered" | "not_found" | "stopped" | "error";

export interface QueryResponse {
  conversation_id: string;
  message_id?: string;
  query: string;
  answer: string;
  status?: AnswerStatus;
  sources: QuerySource[];
  user_id: string;
  tenant_id: string;
}

/** Classic request/response (question sent in the JSON body, not the URL). */
export const queryDocuments = async (
  query: string,
  conversationId?: string,
): Promise<QueryResponse> => {
  const response = await apiClient.post<QueryResponse>("/query/", {
    query,
    conversation_id: conversationId ?? null,
  });
  return response.data;
};

export interface StreamHandlers {
  onMeta?: (data: { conversation_id: string }) => void;
  onToken?: (text: string) => void;
  onSources?: (sources: QuerySource[]) => void;
  onDone?: (data: { message_id: string; status: AnswerStatus }) => void;
  onError?: (detail: string) => void;
}

/**
 * Streams an answer with Server-Sent Events over fetch (EventSource cannot
 * send the Authorization header). Abort the signal to stop generation.
 */
export const streamQuery = async (
  query: string,
  conversationId: string | undefined,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> => {
  const send = () => {
    const token = getAccessToken();
    return fetch(`${API_BASE_URL}/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, conversation_id: conversationId ?? null }),
      signal,
    });
  };
  let response = await send();
  if (response.status === 401 && (await refreshSession())) {
    response = await send();
  }

  if (!response.ok || !response.body) {
    let detail = "Unable to process your question.";
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* ignore */
    }
    if (response.status === 401) {
      redirectToLogin();
    }
    handlers.onError?.(detail);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (event === "meta") handlers.onMeta?.(parsed);
      else if (event === "token") handlers.onToken?.(parsed.text ?? "");
      else if (event === "sources") handlers.onSources?.(parsed.sources ?? []);
      else if (event === "done") handlers.onDone?.(parsed);
      else if (event === "error") handlers.onError?.(parsed.detail ?? "Error");
    }
  }
};

export const sendFeedback = async (
  messageId: string,
  rating: "up" | "down",
  reason?: string,
): Promise<void> => {
  await apiClient.post(`/conversations/messages/${messageId}/feedback`, { rating, reason });
};
