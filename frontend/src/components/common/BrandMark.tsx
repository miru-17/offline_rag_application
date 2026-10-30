import { Box } from "@mui/material";

interface BrandMarkProps {
  size?: number;
}

/**
 * RAGENTIS mark: a query point (centre) connected to three retrieved
 * knowledge nodes — the shape of retrieval-augmented generation.
 */
export default function BrandMark({ size = 32 }: BrandMarkProps) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.3)}px`,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(140deg, #3F6BFF 0%, #6A5CFF 55%, #22C7DD 120%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.25) inset, 0 6px 18px -6px rgba(79,108,255,0.7)",
      }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <g stroke="rgba(255,255,255,0.75)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 12 L5 6.5" />
          <path d="M12 12 L19 6.5" />
          <path d="M12 12 L12 20" />
        </g>
        <circle cx="5" cy="6.5" r="2.2" fill="#fff" />
        <circle cx="19" cy="6.5" r="2.2" fill="#fff" />
        <circle cx="12" cy="20" r="2.2" fill="#fff" />
        <circle cx="12" cy="12" r="3.2" fill="#fff" />
        <circle cx="12" cy="12" r="1.4" fill="#4F6CFF" />
      </svg>
    </Box>
  );
}
