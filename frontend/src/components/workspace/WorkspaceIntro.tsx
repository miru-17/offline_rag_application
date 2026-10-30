import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";

import BrandMark from "../common/BrandMark";
import FileTypeIcon from "../common/FileTypeIcon";
import type { DocumentItem } from "../../api/documents.api";

interface WorkspaceIntroProps {
  documents: DocumentItem[];
  loading: boolean;
  canUpload: boolean;
  onAsk: (question: string) => void;
  onUpload: () => void;
}

const stripExtension = (name: string) => name.replace(/\.(pdf|docx|xlsx)$/i, "");

export default function WorkspaceIntro({ documents, loading, canUpload, onAsk, onUpload }: WorkspaceIntroProps) {
  const indexed = documents.filter((d) => d.processed);

  // Suggestions are built from the user's real, indexed documents.
  const suggestions: { question: string; filename?: string; fileType?: string }[] = [
    ...indexed.slice(0, 3).map((d) => ({
      question: `Summarise the key points of “${stripExtension(d.filename)}”`,
      filename: d.filename,
      fileType: d.file_type,
    })),
  ];
  if (indexed.length > 1) suggestions.push({ question: "What topics do my documents cover?" });
  if (indexed.length > 0) suggestions.push({ question: "List any dates, deadlines or figures mentioned in my documents" });

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 760,
        mx: "auto",
        px: 2,
        py: { xs: 4, md: 6 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <Box sx={{ animation: "ragRiseIn 500ms cubic-bezier(0.16,1,0.3,1) both" }}>
        <BrandMark size={48} />
      </Box>
      <Typography
        component="h1"
        sx={{
          mt: 2.5,
          fontSize: { xs: "1.5rem", md: "1.875rem" },
          fontWeight: 600,
          letterSpacing: "-0.03em",
          animation: "ragRiseIn 500ms cubic-bezier(0.16,1,0.3,1) 60ms both",
        }}
      >
        What would you like to know?
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 1, maxWidth: 520, animation: "ragRiseIn 500ms cubic-bezier(0.16,1,0.3,1) 120ms both" }}
      >
        {loading
          ? "Loading your library…"
          : indexed.length > 0
            ? `Answers are drawn from your ${indexed.length} indexed document${indexed.length === 1 ? "" : "s"}, with citations to the passages used.`
            : "There are no indexed documents yet, so there's nothing to answer from."}
      </Typography>

      <Box
        sx={{
          mt: 4,
          width: "100%",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.25,
          textAlign: "left",
        }}
      >
        {loading &&
          [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: "12px" }} />)}

        {!loading &&
          suggestions.map((s, i) => (
            <ButtonBase
              key={s.question}
              onClick={() => onAsk(s.question)}
              sx={(theme) => ({
                justifyContent: "flex-start",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                minHeight: 64,
                borderRadius: "12px",
                textAlign: "left",
                border: `1px solid ${theme.palette.rag.line}`,
                bgcolor: theme.palette.rag.surface,
                animation: `ragRiseIn 460ms cubic-bezier(0.16,1,0.3,1) ${180 + i * 60}ms both`,
                transition: "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
                "&:hover": {
                  borderColor: theme.palette.rag.primary,
                  transform: "translateY(-2px)",
                  boxShadow: theme.palette.rag.shadow,
                },
                "&:hover .go": { opacity: 1, transform: "translate(0,0)" },
                "&.Mui-focusVisible": { boxShadow: theme.palette.rag.focus },
              })}
            >
              {s.filename ? (
                <FileTypeIcon filename={s.filename} fileType={s.fileType} size={30} />
              ) : (
                <Box sx={(theme) => ({ width: 25, height: 30, borderRadius: "6px", bgcolor: theme.palette.rag.generateSoft, flexShrink: 0 })} />
              )}
              <Typography sx={{ fontSize: "0.8438rem", flex: 1, lineHeight: 1.45 }}>{s.question}</Typography>
              <NorthEastRoundedIcon
                className="go"
                sx={{ fontSize: 16, color: "primary.main", opacity: 0, transform: "translate(-3px,3px)", transition: "all 180ms ease" }}
              />
            </ButtonBase>
          ))}

        {!loading && indexed.length === 0 && canUpload && (
          <ButtonBase
            onClick={onUpload}
            sx={(theme) => ({
              gridColumn: "1 / -1",
              justifyContent: "center",
              gap: 1,
              p: 2,
              borderRadius: "12px",
              border: `1px dashed ${theme.palette.rag.lineStrong}`,
              color: theme.palette.text.primary,
              fontSize: "0.875rem",
              "&:hover": { borderColor: theme.palette.rag.primary, bgcolor: theme.palette.rag.primarySoft },
            })}
          >
            <UploadFileOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
            Upload documents to get started
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}
