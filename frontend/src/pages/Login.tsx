import {
  useEffect,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { getSetupStatus } from "../api/auth.api";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";

import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";

import {
  Link as RouterLink,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import loginBg from "../assets/login-bg.png";

// =============================================================
// CONFIG
// =============================================================

// Set VITE_API_BASE_URL in your .env files (Vite). Falls back to local dev.
const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

// Keep in sync with your backend validation.
const MIN_PASSWORD_LENGTH = 8;

// Turn on once a /forgot-password route exists.
const SHOW_FORGOT_PASSWORD = true;
const FORGOT_PASSWORD_ROUTE = "/forgot-password";

// =============================================================
// DESIGN TOKENS
// =============================================================

const t = {
  pageBg: "#020617",

  text: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#a3b0c6", // ~8:1 on the card background
  textSubtle: "#8a98b0", // ~5.8:1, smallest allowed text tone

  accent: "#a5b4fc",
  accentSoft: "#c4b5fd",

  border: "rgba(148,163,184,0.24)",
  borderHover: "rgba(165,180,252,0.45)",
  borderFocus: "rgba(165,180,252,0.85)",

  fieldBg: "rgba(6,12,30,0.78)",

  danger: "#fca5a5",
  warning: "#fbbf24",
} as const;

// Wordmark: white fading to soft lavender, one solid colour per letter.
const WORDMARK = "RAGENTIS".split("");

const WORDMARK_COLORS = [
  "#ffffff",
  "#fdfdff",
  "#f8f7ff",
  "#f0edff",
  "#e8e3ff",
  "#e0d9ff",
  "#d8cffe",
  "#cfc3fd",
];

// =============================================================
// TYPES
// =============================================================

type Mode = "login" | "signup";

type FieldName =
  | "username"
  | "email"
  | "password"
  | "confirmPassword";

type FormValues = Record<FieldName, string>;

type FieldErrors = Partial<Record<FieldName, string>>;

interface Notice {
  type: "error" | "success";
  message: string;
}

const INITIAL_VALUES: FormValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

// Order used to focus the first invalid field.
const FIELD_ORDER: FieldName[] = [
  "username",
  "email",
  "password",
  "confirmPassword",
];

// =============================================================
// HELPERS
// =============================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// FastAPI returns `detail` as a string, or as a list of
// validation issues. Handle both.
function extractApiError(
  data: unknown,
  fallback: string,
): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const message = (detail[0] as { msg?: unknown })?.msg;

      if (typeof message === "string") {
        return message;
      }
    }
  }

  return fallback;
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { score: 1, label: "Too short", color: "#f87171" };
  }

  let score = 1;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "", color: "" },
    { label: "Weak", color: "#fb923c" },
    { label: "Fair", color: "#facc15" },
    { label: "Good", color: "#a3e635" },
    { label: "Strong", color: "#4ade80" },
  ];

  return { score, ...levels[score] };
}

// Single orchestrated page-load sequence. Disabled automatically
// for people who prefer reduced motion.
const reveal = (
  name: string,
  duration: string,
  delay = "0s",
  easing = "cubic-bezier(0.16,1,0.3,1)",
) => ({
  animation: `${name} ${duration} ${easing} ${delay} both`,

  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

// =============================================================
// SHARED FIELD STYLES
// =============================================================

const fieldSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    height: { xs: 56, lg: 64 },
    borderRadius: "12px",
    backgroundColor: t.fieldBg,
    color: t.text,

    transition:
      "border-color 0.2s ease, box-shadow 0.2s ease",

    "& fieldset": { borderColor: t.border },

    "&:hover fieldset": { borderColor: t.borderHover },

    "&.Mui-focused": {
      boxShadow: "0 0 0 4px rgba(99,102,241,0.16)",
    },

    "&.Mui-focused fieldset": {
      borderColor: t.borderFocus,
      borderWidth: 1,
    },

    "&.Mui-error fieldset": {
      borderColor: "rgba(248,113,113,0.70)",
    },

    "&.Mui-error.Mui-focused": {
      boxShadow: "0 0 0 4px rgba(248,113,113,0.14)",
    },

    "&.Mui-disabled": { opacity: 0.6 },
  },

  "& input": {
    fontSize: "1.05rem",
  },

  "& input::placeholder": {
    color: "#75849d",
    opacity: 1,
  },

  // Keep the dark theme when the browser autofills credentials
  // (otherwise Chrome paints the field pale blue).
  "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus":
    {
      WebkitBoxShadow: "0 0 0 100px #0a1128 inset",
      WebkitTextFillColor: t.text,
      caretColor: t.text,
      borderRadius: "inherit",
      transition:
        "background-color 9999s ease-in-out 0s",
    },

  "& .MuiFormHelperText-root": {
    marginLeft: "2px",
    marginTop: "8px",
    fontSize: "0.8rem",
    color: t.textMuted,
  },

  "& .MuiFormHelperText-root.Mui-error": {
    color: t.danger,
  },
};

// =============================================================
// SMALL COMPONENTS
// =============================================================

function FormField({
  id,
  label,
  labelAction,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
  disabled,
  autoFocus,
  error,
  helperText,
  endAdornment,
  onKeyUp,
  onBlur,
  children,
}: {
  id: FieldName;
  label: string;
  labelAction?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  type?: string;
  disabled: boolean;
  autoFocus?: boolean;
  error?: string;
  helperText?: ReactNode;
  endAdornment?: ReactNode;
  onKeyUp?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 0.9,
        }}
      >
        <Typography
          component="label"
          htmlFor={id}
          sx={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: t.textSecondary,
          }}
        >
          {label}
        </Typography>

        {labelAction}
      </Box>

      <TextField
        id={id}
        name={id}
        fullWidth
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        error={Boolean(error)}
        helperText={error ?? helperText}
        slotProps={{
          input: { endAdornment },
          htmlInput: {
            spellCheck: false,
            autoCapitalize: "none",
            onKeyUp,
            onBlur,
          },
        }}
        sx={fieldSx}
      />

      {children}
    </Box>
  );
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { score, label, color } = getPasswordStrength(password);

  return (
    <Box sx={{ mt: 1.4 }} aria-live="polite">
      <Box sx={{ display: "flex", gap: 0.6 }}>
        {[1, 2, 3, 4].map((segment) => (
          <Box
            key={segment}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                segment <= score
                  ? color
                  : "rgba(148,163,184,0.20)",
              transition: "background-color 0.25s ease",
            }}
          />
        ))}
      </Box>

      <Typography
        sx={{
          mt: 0.8,
          fontSize: "0.8rem",
          color: t.textMuted,
        }}
      >
        Password strength:{" "}
        <Box
          component="span"
          sx={{ color, fontWeight: 600 }}
        >
          {label}
        </Box>
      </Typography>
    </Box>
  );
}

function PasswordField({
  showStrength,
  ...props
}: Omit<
  ComponentProps<typeof FormField>,
  "type" | "endAdornment" | "onKeyUp" | "onBlur"
> & { showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  return (
    <FormField
      {...props}
      type={visible ? "text" : "password"}
      onKeyUp={(event) =>
        setCapsLockOn(event.getModifierState("CapsLock"))
      }
      onBlur={() => setCapsLockOn(false)}
      helperText={
        capsLockOn ? (
          <Box component="span" sx={{ color: t.warning }}>
            Caps Lock is on
          </Box>
        ) : undefined
      }
      endAdornment={
        <InputAdornment position="end">
          <IconButton
            aria-label={
              visible ? "Hide password" : "Show password"
            }
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
            // keep focus in the input while toggling
            onMouseDown={(event) => event.preventDefault()}
            edge="end"
            disabled={props.disabled}
            sx={{
              color: t.textMuted,

              "&:hover": {
                color: t.accentSoft,
                backgroundColor: "rgba(129,140,248,0.08)",
              },

              "&.Mui-focusVisible": {
                outline: `2px solid ${t.accent}`,
              },
            }}
          >
            {visible ? (
              <VisibilityOffOutlinedIcon />
            ) : (
              <VisibilityOutlinedIcon />
            )}
          </IconButton>
        </InputAdornment>
      }
    >
      {showStrength && (
        <PasswordStrengthMeter password={props.value} />
      )}
    </FormField>
  );
}

function TrustBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <Box
      component="li"
      sx={{
        listStyle: "none",
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1.1,
        borderRadius: "10px",
        background: "rgba(7,14,32,0.72)",
        border: "1px solid rgba(148,163,184,0.20)",
        color: t.accent,
      }}
    >
      {icon}

      <Typography
        sx={{
          fontSize: "0.86rem",
          fontWeight: 600,
          color: "#e2e8f0",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// =============================================================
// PAGE
// =============================================================

export default function Login() {
  const navigate = useNavigate();
  const { login, completeMfa } = useAuth();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  const submitMfa = async () => {
    if (!mfaToken) return;
    setMfaBusy(true);
    setMfaError("");
    try {
      await completeMfa(mfaToken, mfaCode.trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setMfaError(typeof detail === "string" ? detail : "The code is not correct.");
      if (typeof detail === "string" && detail.includes("expired")) setMfaToken(null);
    } finally {
      setMfaBusy(false);
    }
  };

  const [mode, setMode] = useState<Mode>("login");
  const isSignup = mode === "signup";

  const [values, setValues] =
    useState<FormValues>(INITIAL_VALUES);

  const [fieldErrors, setFieldErrors] =
    useState<FieldErrors>({});

  const [notice, setNotice] = useState<Notice | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sign-up is available on first run (creates the administrator) or when
  // the administrator has enabled self-registration.
  const [setup, setSetup] = useState<{ needs_setup: boolean; self_registration: boolean } | null>(null);
  useEffect(() => {
    getSetupStatus()
      .then((status) => {
        setSetup(status);
        if (status.needs_setup) setMode("signup");
      })
      .catch(() => setSetup(null));
  }, []);

  // -----------------------------------------------------------
  // Field helpers
  // -----------------------------------------------------------

  const updateField = (field: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));

    // Clear the error for a field as soon as the user edits it.
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );

    setNotice((current) =>
      current?.type === "error" ? null : current,
    );
  };

  const switchMode = () => {
    if (mode === "login" && setup && !setup.self_registration) {
      setNotice({
        type: "error",
        message: "Self-registration is disabled. Ask your administrator to create an account for you.",
      });
      return;
    }
    setMode((current) =>
      current === "login" ? "signup" : "login",
    );
    setValues(INITIAL_VALUES);
    setFieldErrors({});
    setNotice(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!values.username.trim()) {
      errors.username = "Enter your username.";
    }

    if (isSignup) {
      if (!values.email.trim()) {
        errors.email = "Enter your email address.";
      } else if (!EMAIL_PATTERN.test(values.email.trim())) {
        errors.email =
          "Enter a valid email address, like name@company.com.";
      }
    }

    if (!values.password) {
      errors.password = "Enter your password.";
    } else if (
      isSignup &&
      values.password.length < MIN_PASSWORD_LENGTH
    ) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (isSignup) {
      if (!values.confirmPassword) {
        errors.confirmPassword = "Re-enter your password.";
      } else if (values.confirmPassword !== values.password) {
        errors.confirmPassword =
          "Passwords don't match. Check both fields and try again.";
      }
    }

    return errors;
  };

  // -----------------------------------------------------------
  // Submit
  // -----------------------------------------------------------

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) return;

    setNotice(null);

    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);

      const firstInvalid = FIELD_ORDER.find(
        (field) => errors[field],
      );

      if (firstInvalid) {
        document.getElementById(firstInvalid)?.focus();
      }

      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    // ---------------------------------------------------------
    // SIGN UP
    // ---------------------------------------------------------

    if (isSignup) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/register`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: values.username.trim(),
              email: values.email.trim(),
              password: values.password,
            }),
          },
        );

        const data: unknown = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          throw new Error(
            extractApiError(
              data,
              "We couldn't create your account. Try again.",
            ),
          );
        }

        // Hand the user straight to sign in with their username filled.
        setMode("login");
        setValues({
          ...INITIAL_VALUES,
          username: values.username.trim(),
        });
        setNotice({
          type: "success",
          message: setup?.needs_setup
            ? "Administrator account created. Sign in, then install your licence."
            : "Account created. Sign in to continue.",
        });
        if (setup?.needs_setup) setSetup({ needs_setup: false, self_registration: false });
      } catch (signupError) {
        setNotice({
          type: "error",
          message:
            signupError instanceof TypeError
              ? "Can't reach the server. Check your connection and try again."
              : signupError instanceof Error
                ? signupError.message
                : "We couldn't create your account. Try again.",
        });
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    // ---------------------------------------------------------
    // SIGN IN
    // ---------------------------------------------------------

    try {
      const challenge = await login(values.username.trim(), values.password);

      if (challenge?.mfaRequired) {
        setMfaToken(challenge.mfaToken);
        setMfaCode("");
        setMfaError("");
        setIsSubmitting(false);
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      const response = (loginError as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
      const detail = typeof response?.data?.detail === "string" ? response.data.detail : null;
      setNotice({
        type: "error",
        message:
          loginError instanceof TypeError || (!response && (loginError as { code?: string })?.code === "ERR_NETWORK")
            ? "Can't reach the server. Check your connection and try again."
            : response?.status === 401 || !detail
              ? "The username or password is incorrect. Check your details and try again."
              : detail,
      });

      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------
  // UI
  // -----------------------------------------------------------

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
        backgroundColor: t.pageBg,
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "#fff",

        // Left-heavy overlay keeps the wordmark readable and lets the
        // background show through behind the card.
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(2,6,23,0.90) 0%, rgba(2,6,23,0.62) 50%, rgba(2,6,23,0.84) 100%)",
          pointerEvents: "none",
        },

        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 78% 50%, rgba(99,102,241,0.14), transparent 70%), linear-gradient(180deg, rgba(2,6,23,0.05), rgba(2,6,23,0.55))",
          pointerEvents: "none",
        },

        "@keyframes brandReveal": {
          from: {
            opacity: 0,
            transform: "translateX(-28px)",
          },
          to: {
            opacity: 1,
            transform: "translateX(0)",
          },
        },

        "@keyframes riseIn": {
          from: { opacity: 0, transform: "translateY(14px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },

        "@keyframes cardReveal": {
          from: { opacity: 0, transform: "translateX(28px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          boxSizing: "border-box",
          minHeight: "100dvh",
          width: "100%",
          // Full-bleed: no max-width cap, so content reaches the
          // screen edges instead of floating in the middle.

          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 1fr) minmax(0, 1fr)",
          },
          alignItems: "center",
          columnGap: { md: 6, lg: 10 },
          rowGap: { xs: 5, md: 0 },

          // Small, viewport-based edge gap (32px to 80px)
          px: { xs: 2.5, sm: 4, md: "clamp(32px, 4vw, 80px)" },
          py: { xs: 5, md: 6 },
        }}
      >
        {/* ===================================================
            BRANDING
        ==================================================== */}

        <Box sx={{ width: "100%", maxWidth: 820 }}>
          <Box
            aria-hidden
            sx={{
              width: { xs: 60, md: 76 },
              height: { xs: 60, md: 76 },
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: { xs: 3, md: 4 },
              background: "rgba(8,15,35,0.72)",
              border: "1px solid rgba(255,255,255,0.16)",
              backdropFilter: "blur(15px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
              ...reveal("riseIn", "0.6s"),
            }}
          >
            <AutoAwesomeOutlinedIcon
              sx={{
                fontSize: { xs: 30, md: 38 },
                color: t.accentSoft,
              }}
            />
          </Box>

          <Typography
            component="h1"
            aria-label="RAGENTIS"
            sx={{
              // Scales with the viewport so it always fits its column.
              fontSize: "clamp(3.25rem, 7.4vw, 9rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              color: "#ffffff",
              pr: "0.1em",
              mb: { xs: 1.5, md: 2.5 },

              // A soft glow instead of a clipped gradient: every letter is
              // plain solid text, so no part of the "S" can ever be cut.
              textShadow: "0 0 70px rgba(129,140,248,0.35)",

              ...reveal("brandReveal", "0.9s"),
            }}
          >
            {WORDMARK.map((letter, index) => (
              <Box
                key={index}
                component="span"
                aria-hidden
                sx={{ color: WORDMARK_COLORS[index] }}
              >
                {letter}
              </Box>
            ))}
          </Typography>

          <Typography
            component="p"
            sx={{
              fontSize: "clamp(1.4rem, 2.2vw, 2.1rem)",
              fontWeight: 600,
              color: "rgba(241,245,249,0.95)",
              lineHeight: 1.35,
              letterSpacing: "-0.015em",
              maxWidth: 620,
              mb: 2.2,
              ...reveal("riseIn", "0.7s", "0.45s"),
            }}
          >
            Context-aware intelligence,
            <br />
            <Box
              component="span"
              sx={{ color: "rgba(203,213,225,0.82)" }}
            >
              built on your knowledge.
            </Box>
          </Typography>

          <Typography
            component="p"
            sx={{
              fontSize: { xs: "1rem", md: "1.08rem" },
              color: t.textMuted,
              lineHeight: 1.7,
              maxWidth: 560,
              mb: 4,
              ...reveal("riseIn", "0.7s", "0.55s"),
            }}
          >
            A private knowledge workspace for securely
            retrieving and interacting with your enterprise
            information.
          </Typography>

          <Box
            component="ul"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.4,
              m: 0,
              p: 0,
              ...reveal("riseIn", "0.7s", "0.65s"),
            }}
          >
            <TrustBadge
              icon={<SecurityOutlinedIcon sx={{ fontSize: 20 }} />}
              label="Private"
            />

            <TrustBadge
              icon={<CloudOffOutlinedIcon sx={{ fontSize: 20 }} />}
              label="Offline"
            />
          </Box>
        </Box>

        {/* ===================================================
            AUTH CARD
        ==================================================== */}

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            ...reveal("cardReveal", "0.8s", "0.15s"),
          }}
        >
          <Paper
            component="section"
            aria-labelledby="auth-heading"
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              width: "100%",
              maxWidth: { xs: 520, md: 640, lg: 740, xl: 800 },
              p: { xs: 3, sm: 4.5, md: 6, lg: 8 },
              borderRadius: { xs: "18px", md: "22px" },
              background: "rgba(3,8,24,0.90)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(25px)",
              WebkitBackdropFilter: "blur(25px)",
              boxShadow:
                "0 35px 90px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Top accent */}
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                top: 0,
                left: "12%",
                right: "12%",
                height: 2,
                background:
                  "linear-gradient(90deg, transparent, #6366f1, #a78bfa, transparent)",
              }}
            />

            {/* Header */}
            <Box sx={{ mb: 3.5 }}>
              <Typography
                id="auth-heading"
                component="h2"
                sx={{
                  fontSize: { xs: "1.75rem", md: "2.25rem", lg: "2.6rem" },
                  fontWeight: 750,
                  letterSpacing: "-0.03em",
                  color: t.text,
                  mb: 0.8,
                }}
              >
                {isSignup ? "Create your account" : "Welcome back"}
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: "0.95rem", lg: "1.05rem" },
                  color: t.textMuted,
                  lineHeight: 1.6,
                  maxWidth: 540,
                }}
              >
                {isSignup
                  ? "Create an account to access your private knowledge workspace."
                  : "Sign in to continue to your private knowledge workspace."}
              </Typography>
            </Box>

            {/* Notice (success / error) */}
            {notice && (
              <Alert
                severity={notice.type}
                sx={{
                  mb: 2.8,
                  borderRadius: "11px",
                  alignItems: "center",
                  fontSize: "0.9rem",

                  ...(notice.type === "success"
                    ? {
                        backgroundColor: "rgba(20,83,45,0.24)",
                        color: "#bbf7d0",
                        border: "1px solid rgba(74,222,128,0.24)",
                      }
                    : {
                        backgroundColor: "rgba(127,29,29,0.24)",
                        color: "#fecaca",
                        border: "1px solid rgba(248,113,113,0.26)",
                      }),
                }}
              >
                {notice.message}
              </Alert>
            )}

            {/* Form. `key` remounts fields on mode switch, which resets
                password visibility and re-focuses the first field. */}
            <Box
              key={mode}
              component="form"
              onSubmit={handleSubmit}
              noValidate
              aria-busy={isSubmitting}
            >
              <FormField
                id="username"
                label="Username"
                value={values.username}
                onChange={updateField("username")}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                error={fieldErrors.username}
              />

              {isSignup && (
                <FormField
                  id="email"
                  label="Email address"
                  type="email"
                  value={values.email}
                  onChange={updateField("email")}
                  placeholder="name@company.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  error={fieldErrors.email}
                />
              )}

              <PasswordField
                id="password"
                label="Password"
                value={values.password}
                onChange={updateField("password")}
                placeholder="Enter your password"
                autoComplete={
                  isSignup ? "new-password" : "current-password"
                }
                disabled={isSubmitting}
                error={fieldErrors.password}
                showStrength={isSignup}
                labelAction={
                  !isSignup && SHOW_FORGOT_PASSWORD ? (
                    <Link
                      component={RouterLink}
                      to={FORGOT_PASSWORD_ROUTE}
                      underline="hover"
                      sx={{
                        fontSize: "0.92rem",
                        fontWeight: 600,
                        color: t.accent,

                        "&:hover": { color: t.accentSoft },
                      }}
                    >
                      Forgot password?
                    </Link>
                  ) : undefined
                }
              />

              {isSignup && (
                <PasswordField
                  id="confirmPassword"
                  label="Confirm password"
                  value={values.confirmPassword}
                  onChange={updateField("confirmPassword")}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  error={fieldErrors.confirmPassword}
                />
              )}

              <Button
                type="submit"
                fullWidth
                disabled={isSubmitting}
                endIcon={
                  !isSubmitting ? (
                    <ArrowForwardRoundedIcon />
                  ) : undefined
                }
                sx={{
                  mt: 1,
                  height: { xs: 56, lg: 64 },
                  borderRadius: "12px",
                  textTransform: "none",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  background:
                    "linear-gradient(100deg, #4f46e5, #6366f1)",
                  boxShadow: "0 12px 30px rgba(79,70,229,0.28)",
                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",

                  "&:hover": {
                    background:
                      "linear-gradient(100deg, #4338ca, #5b5ff0)",
                    boxShadow: "0 15px 35px rgba(79,70,229,0.36)",
                    transform: "translateY(-1px)",
                  },

                  "&:active": { transform: "translateY(0)" },

                  "&.Mui-focusVisible": {
                    outline: "2px solid #c7d2fe",
                    outlineOffset: 3,
                  },

                  "&.Mui-disabled": {
                    color: "rgba(255,255,255,0.92)",
                    background:
                      "linear-gradient(100deg, #4f46e5, #6366f1)",
                    opacity: 0.75,
                  },
                }}
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress
                      size={18}
                      color="inherit"
                      sx={{ mr: 1.4 }}
                    />
                    {isSignup
                      ? "Creating account…"
                      : "Signing in…"}
                  </>
                ) : isSignup ? (
                  "Create account"
                ) : (
                  "Sign in"
                )}
              </Button>
            </Box>

            {/* Mode switch */}
            <Box
              sx={{
                mt: 3.2,
                pt: 2.8,
                borderTop: "1px solid rgba(148,163,184,0.14)",
                textAlign: "center",
              }}
            >
              <Typography
                component="span"
                sx={{ fontSize: "0.98rem", color: t.textMuted }}
              >
                {isSignup
                  ? "Already have an account? "
                  : "Don't have an account? "}
              </Typography>

              <Typography
                component="button"
                type="button"
                onClick={switchMode}
                disabled={isSubmitting}
                sx={{
                  border: 0,
                  p: 0,
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.98rem",
                  fontWeight: 700,
                  color: t.accent,
                  borderRadius: "4px",

                  "&:hover": {
                    color: t.accentSoft,
                    textDecoration: "underline",
                  },

                  "&:focus-visible": {
                    outline: `2px solid ${t.accent}`,
                    outlineOffset: 3,
                  },

                  "&:disabled": {
                    cursor: "not-allowed",
                    opacity: 0.6,
                  },
                }}
              >
                {isSignup ? "Sign in" : "Create account"}
              </Typography>
            </Box>

            <Typography
              sx={{
                mt: 2.8,
                textAlign: "center",
                fontSize: "0.8rem",
                color: t.textSubtle,
                letterSpacing: "0.02em",
              }}
            >
              Ragentis, your intelligent knowledge workspace
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Dialog open={mfaToken !== null} onClose={() => !mfaBusy && setMfaToken(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Two-step verification</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the 6-digit code from your authenticator app.
          </Typography>
          {mfaError && <Alert severity="error" sx={{ mb: 2 }}>{mfaError}</Alert>}
          <TextField
            autoFocus
            fullWidth
            label="Code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mfaCode.length === 6) void submitMfa();
            }}
            slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "one-time-code", "aria-label": "Authentication code" } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMfaToken(null)} disabled={mfaBusy}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitMfa()} disabled={mfaBusy || mfaCode.length !== 6}>
            {mfaBusy ? "Checking…" : "Verify"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
