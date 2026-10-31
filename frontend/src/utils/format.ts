import { isAxiosError } from "axios";

export type FileKind = "pdf" | "docx" | "xlsx" | "image" | "other";

export const getFileKind = (filename?: string, fileType?: string): FileKind => {
  const source = `${fileType ?? ""} ${filename ?? ""}`.toLowerCase();
  if (source.includes("pdf")) return "pdf";
  if (source.includes("docx") || source.includes("word")) return "docx";
  if (source.includes("xlsx") || source.includes("sheet")) return "xlsx";
  if (/\b(png|jpe?g)\b|\.(png|jpe?g)\b/.test(source)) return "image";
  return "other";
};

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  image: "Image (read with OCR)",
  other: "File",
};

const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  // Backend timestamps are naive UTC; treat them as UTC when no zone is given.
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: string | null): string => {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateTime = (value?: string | null): string => {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatRelative = (value?: string | null): string => {
  const date = toDate(value);
  if (!date) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(value);
};

export const getTimestamp = (value?: string | null): number =>
  toDate(value)?.getTime() ?? 0;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Pull the most useful human-readable message out of an API error. */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Can't reach the RAGENTIS API. Check that the backend is running.";
    }
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};
