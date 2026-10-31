import { Box } from "@mui/material";

import { getFileKind, type FileKind } from "../../utils/format";

const KIND_STYLE: Record<FileKind, { label: string; color: string }> = {
  pdf: { label: "PDF", color: "#F06A6A" },
  docx: { label: "DOC", color: "#5B8CFF" },
  xlsx: { label: "XLS", color: "#2FBF8A" },
  image: { label: "IMG", color: "#B07CF0" },
  other: { label: "FILE", color: "#8D9AB3" },
};

interface FileTypeIconProps {
  filename?: string;
  fileType?: string;
  size?: number;
}

/** A small document glyph with a folded corner, tinted by file type. */
export default function FileTypeIcon({ filename, fileType, size = 36 }: FileTypeIconProps) {
  const kind = getFileKind(filename, fileType);
  const { label, color } = KIND_STYLE[kind];
  const fold = Math.round(size * 0.28);

  return (
    <Box
      aria-label={`${label} file`}
      sx={{
        position: "relative",
        width: size * 0.82,
        height: size,
        flexShrink: 0,
        borderRadius: "5px",
        bgcolor: `${color}1F`,
        border: `1px solid ${color}55`,
        clipPath: `polygon(0 0, calc(100% - ${fold}px) 0, 100% ${fold}px, 100% 100%, 0 100%)`,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        pb: `${Math.round(size * 0.12)}px`,
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          right: 0,
          width: fold,
          height: fold,
          background: `linear-gradient(225deg, transparent 50%, ${color}66 50%)`,
        },
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: Math.max(8, Math.round(size * 0.24)),
          fontWeight: 700,
          letterSpacing: "0.02em",
          color,
          lineHeight: 1,
        }}
      >
        {label}
      </Box>
    </Box>
  );
}
