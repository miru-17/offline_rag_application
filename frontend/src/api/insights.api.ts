import apiClient from "./axios";

export interface InsightsOverview {
  days: number;
  questions: number;
  active_users: number;
  answers: { total: number; answered: number; not_found: number; stopped: number; error: number; answer_rate: number | null };
  feedback: { up: number; down: number };
  questions_per_day: { date: string; count: number }[];
}

export interface KnowledgeGaps {
  days: number;
  unanswered_total: number;
  questions: { question: string; count: number }[];
  missing_topics: { topic: string; count: number }[];
  disliked_answers: { question: string; count: number }[];
}

export const getOverview = async (days = 30) =>
  (await apiClient.get<InsightsOverview>("/insights/overview", { params: { days } })).data;

export const getKnowledgeGaps = async (days = 30) =>
  (await apiClient.get<KnowledgeGaps>("/insights/knowledge-gaps", { params: { days } })).data;
