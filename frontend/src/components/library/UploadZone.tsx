import { useRef, useState, type DragEvent } from "react";
import { Box, Button, ButtonBase, IconButton, LinearProgress, Tooltip, Typography } from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";

import { uploadDocument, type UploadOptions } from "../../api/documents.api";
import FileTypeIcon from "../common/FileTypeIcon";
import { formatBytes, getApiErrorMessage } from "../../utils/format";

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED = [".pdf", ".docx", ".xlsx"];

type UploadStatus = "queued" | "uploading" | "indexing" | "done" | "failed";

interface UploadJob {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface UploadZoneProps {
  isAdmin: boolean;
  tenantName?: string;
  large: boolean;
  onUploaded: () => void;
  /** Who can use the uploaded files (private, organisation or a team space). */
  uploadOptions?: UploadOptions;
  sharingLabel?: string;
}

const validate = (file: File): string | null => {
  const lower = file.name.toLowerCase();
  if (!ALLOWED.some((ext) => lower.endsWith(ext))) return "Only PDF, Word (.docx) and Excel (.xlsx) files are supported.";
  if (file.size > MAX_FILE_SIZE) return `File is ${formatBytes(file.size)}; the limit is 25 MB.`;
  if (file.size === 0) return "File is empty.";
  return null;
};

export default function UploadZone({ isAdmin, tenantName, large, onUploaded, uploadOptions, sharingLabel }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const runningRef = useRef(false);
  const queueRef = useRef<UploadJob[]>([]);

  const patch = (id: string, changes: Partial<UploadJob>) => {
    setJobs((current) => current.map((j) => (j.id === id ? { ...j, ...changes } : j)));
  };

  const runQueue = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    let uploadedAny = false;

    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()!;
      patch(job.id, { status: "uploading", progress: 0, error: undefined });
      try {
        await uploadDocument(job.file, (percent) => {
          // Bytes sent is real; the server then indexes it in the background.
          patch(job.id, percent >= 100 ? { status: "indexing", progress: 100 } : { progress: percent });
        }, uploadOptions);
        patch(job.id, { status: "done", progress: 100 });
        uploadedAny = true;
        onUploaded();
      } catch (err) {
        patch(job.id, { status: "failed", error: getApiErrorMessage(err, "Upload failed.") });
      }
    }

    runningRef.current = false;
    if (uploadedAny) {
      // Clear finished rows after a moment so the zone returns to rest.
      window.setTimeout(() => setJobs((current) => current.filter((j) => j.status !== "done")), 4000);
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const newJobs: UploadJob[] = files.map((file) => {
      const error = validate(file);
      return {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        status: error ? "failed" : "queued",
        progress: 0,
        error: error ?? undefined,
      };
    });

    setJobs((current) => [...current, ...newJobs]);
    queueRef.current.push(...newJobs.filter((j) => j.status === "queued"));
    void runQueue();
  };

  const retry = (job: UploadJob) => {
    if (validate(job.file)) return;
    patch(job.id, { status: "queued", error: undefined, progress: 0 });
    queueRef.current.push(job);
    void runQueue();
  };

  const onDrag = (event: DragEvent, over: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(over);
  };

  const busy = jobs.some((j) => j.status === "uploading" || j.status === "indexing" || j.status === "queued");

  return (
    <Box>
      <ButtonBase
        component="div"
        role="button"
        tabIndex={0}
        aria-label="Upload documents: drop files or press Enter to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => onDrag(e, true)}
        onDragOver={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={(e) => {
          onDrag(e, false);
          addFiles(e.dataTransfer.files);
        }}
        sx={(theme) => {
          const t = theme.palette.rag;
          return {
            width: "100%",
            display: "flex",
            flexDirection: large ? "column" : "row",
            alignItems: "center",
            justifyContent: large ? "center" : "flex-start",
            textAlign: large ? "center" : "left",
            gap: large ? 1.5 : 2,
            p: large ? { xs: 4, md: 6 } : 2,
            borderRadius: "14px",
            border: `1.5px dashed ${dragging ? t.primary : t.lineStrong}`,
            bgcolor: dragging ? t.primarySoft : t.surface,
            backgroundImage: dragging
              ? `radial-gradient(400px 160px at 50% 0%, ${t.primarySoft}, transparent)`
              : "none",
            transform: dragging ? "scale(1.005)" : "none",
            transition: "border-color 160ms ease, background-color 160ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1)",
            cursor: "pointer",
            "&:hover": { borderColor: t.primary },
            "&:hover .upload-glyph": { transform: "translateY(-2px)" },
            "&.Mui-focusVisible, &:focus-visible": { boxShadow: t.focus },
          };
        }}
      >
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Box
          className="upload-glyph"
          sx={(theme) => ({
            width: large ? 52 : 40,
            height: large ? 52 : 40,
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: theme.palette.rag.primary,
            bgcolor: theme.palette.rag.primarySoft,
            transition: "transform 200ms cubic-bezier(0.16,1,0.3,1)",
          })}
        >
          <CloudUploadOutlinedIcon sx={{ fontSize: large ? 26 : 21 }} />
        </Box>
        <Box sx={{ flex: large ? "none" : 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: large ? "1rem" : "0.875rem", fontWeight: 560 }}>
            {dragging ? "Drop to upload" : "Drop files here or click to browse"}
          </Typography>
          <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", mt: 0.25 }}>
            PDF, Word or Excel, up to 25 MB each.{" "}
            {sharingLabel ??
              (isAdmin
                ? `Files you upload are shared with everyone in ${tenantName ?? "your organisation"}.`
                : "Files you upload are private to you.")}
          </Typography>
        </Box>
        {!large && (
          <Button component="span" tabIndex={-1} variant="contained" size="small" sx={{ flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }}>
            Choose files
          </Button>
        )}
      </ButtonBase>

      {jobs.length > 0 && (
        <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }} aria-live="polite">
          {jobs.map((job) => (
            <UploadRow
              key={job.id}
              job={job}
              onRetry={() => retry(job)}
              onRemove={() => setJobs((c) => c.filter((j) => j.id !== job.id))}
            />
          ))}
          {!busy && jobs.some((j) => j.status === "failed") && (
            <Button
              size="small"
              sx={{ alignSelf: "flex-end" }}
              onClick={() => setJobs((c) => c.filter((j) => j.status !== "failed"))}
            >
              Clear failed
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

function UploadRow({ job, onRetry, onRemove }: { job: UploadJob; onRetry: () => void; onRemove: () => void }) {
  const label = {
    queued: "Waiting…",
    uploading: `Uploading ${job.progress}%`,
    indexing: "Upload complete…",
    done: "Uploaded — indexing in the background (see the list below)",
    failed: job.error ?? "Failed",
  }[job.status];

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.25,
        pr: 1,
        borderRadius: "12px",
        border: `1px solid ${job.status === "failed" ? `${theme.palette.rag.danger}55` : theme.palette.rag.line}`,
        bgcolor: job.status === "failed" ? theme.palette.rag.dangerSoft : theme.palette.rag.raised,
        animation: "ragRiseIn 320ms cubic-bezier(0.16,1,0.3,1) both",
      })}
    >
      <FileTypeIcon filename={job.file.name} size={32} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography noWrap sx={{ fontSize: "0.8125rem", fontWeight: 540, flex: 1 }}>
            {job.file.name}
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", flexShrink: 0 }}>
            {formatBytes(job.file.size)}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: job.status === "failed" ? "error.main" : job.status === "done" ? "success.main" : "text.secondary",
            mt: 0.25,
          }}
        >
          {label}
        </Typography>
        {(job.status === "uploading" || job.status === "indexing" || job.status === "queued") && (
          <LinearProgress
            variant={job.status === "uploading" ? "determinate" : "indeterminate"}
            value={job.progress}
            color={job.status === "indexing" ? "info" : "primary"}
            sx={{ mt: 0.75, height: 3, opacity: job.status === "queued" ? 0.4 : 1 }}
          />
        )}
      </Box>
      {job.status === "done" && <CheckCircleRoundedIcon sx={{ color: "success.main", fontSize: 20, animation: "ragRiseIn 300ms ease both" }} />}
      {job.status === "failed" && (
        <>
          <ErrorRoundedIcon sx={{ color: "error.main", fontSize: 18 }} />
          {!/supported|limit|empty/.test(job.error ?? "") && (
            <Tooltip title="Retry">
              <IconButton size="small" onClick={onRetry} aria-label={`Retry ${job.file.name}`}>
                <ReplayRoundedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Dismiss">
            <IconButton size="small" onClick={onRemove} aria-label={`Dismiss ${job.file.name}`}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
