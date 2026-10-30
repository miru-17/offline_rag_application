import apiClient from "./axios";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: import("./query.api").QuerySource[] | null;
  answer_status?: import("./query.api").AnswerStatus | null;
  feedback_rating?: "up" | "down" | null;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

export const createConversation = async (
  title: string = "New Chat",
): Promise<Conversation> => {
  const response = await apiClient.post<Conversation>(
    "/conversations/",
    { title },
  );

  return response.data;
};

export const getConversations = async (): Promise<
  Conversation[]
> => {
  const response = await apiClient.get<Conversation[]>(
    "/conversations/",
  );

  return response.data;
};

export const getConversation = async (
  conversationId: string,
): Promise<ConversationDetail> => {
  const response =
    await apiClient.get<ConversationDetail>(
      `/conversations/${conversationId}`,
    );

  return response.data;
};

export const deleteConversation = async (
  conversationId: string,
): Promise<void> => {
  await apiClient.delete(
    `/conversations/${conversationId}`,
  );
};