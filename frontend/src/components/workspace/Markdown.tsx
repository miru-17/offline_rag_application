import { useState, type ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

/* A deliberately small markdown renderer for model answers:
   headings, lists, paragraphs, **bold**, *italic*, `code` and fenced code. */

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Box
      sx={(theme) => ({
        my: 0.5,
        borderRadius: "10px",
        overflow: "hidden",
        border: `1px solid ${theme.palette.rag.line}`,
        bgcolor: theme.palette.mode === "dark" ? "#060A12" : "#0E1628",
      })}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.5,
          borderBottom: "1px solid rgba(140,165,210,0.12)",
        }}
      >
        <Typography className="font-mono" sx={{ fontSize: "0.72rem", color: "#8D9AB3" }}>
          {language}
        </Typography>
        <ButtonBase
          onClick={copy}
          sx={{ gap: 0.5, px: 0.75, py: 0.25, borderRadius: "6px", color: copied ? "#34D399" : "#8D9AB3", fontSize: "0.72rem", "&:hover": { color: "#E7ECF6" } }}
        >
          {copied ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <ContentCopyOutlinedIcon sx={{ fontSize: 13 }} />}
          {copied ? "Copied" : "Copy"}
        </ButtonBase>
      </Box>
      <Box
        component="pre"
        className="font-mono"
        sx={{ m: 0, p: 1.75, fontSize: "0.8rem", lineHeight: 1.6, overflowX: "auto", color: "#E7ECF6" }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  );
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <Box component="strong" key={i} sx={{ fontWeight: 620 }}>
          {part.slice(2, -2)}
        </Box>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <Box
          component="code"
          key={i}
          sx={(theme) => ({
            px: 0.6,
            py: 0.1,
            borderRadius: "5px",
            fontSize: "0.85em",
            bgcolor: theme.palette.rag.raised,
            border: `1px solid ${theme.palette.rag.line}`,
          })}
        >
          {part.slice(1, -1)}
        </Box>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <Box component="em" key={i}>
          {part.slice(1, -1)}
        </Box>
      );
    }
    return part;
  });
}

const LIST_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

function Blocks({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
        if (heading && !trimmed.includes("\n")) {
          const level = heading[1].length;
          return (
            <Typography
              key={bi}
              sx={{ fontWeight: 620, fontSize: level <= 2 ? "1.0625rem" : "0.9688rem", mt: 0.5, letterSpacing: "-0.01em" }}
            >
              {renderInline(heading[2])}
            </Typography>
          );
        }

        const lines = trimmed.split("\n");
        if (lines.every((line) => LIST_RE.test(line))) {
          const ordered = /^\s*\d/.test(lines[0]);
          return (
            <Box
              key={bi}
              component={ordered ? "ol" : "ul"}
              sx={{ m: 0, pl: 2.75, display: "flex", flexDirection: "column", gap: 0.6, "& li::marker": { color: "text.secondary" } }}
            >
              {lines.map((line, li) => (
                <li key={li}>{renderInline(line.replace(LIST_RE, ""))}</li>
              ))}
            </Box>
          );
        }

        return (
          <Typography key={bi} component="p" sx={{ m: 0, fontSize: "inherit", lineHeight: "inherit", whiteSpace: "pre-line" }}>
            {renderInline(trimmed)}
          </Typography>
        );
      })}
    </>
  );
}

export default function Markdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        fontSize: "0.9375rem",
        lineHeight: 1.7,
        color: "text.primary",
        wordBreak: "break-word",
      }}
    >
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const raw = part.slice(3, -3);
          const newline = raw.indexOf("\n");
          const first = newline === -1 ? "" : raw.slice(0, newline).trim();
          const hasLang = first && !first.includes(" ");
          return (
            <CodeBlock
              key={i}
              language={hasLang ? first : "text"}
              code={(hasLang ? raw.slice(newline + 1) : raw).trimEnd()}
            />
          );
        }
        return <Blocks key={i} text={part} />;
      })}
    </Box>
  );
}
