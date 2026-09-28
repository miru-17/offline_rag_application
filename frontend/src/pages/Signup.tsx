import { useState, type FormEvent } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";

import { useNavigate } from "react-router-dom";

import { registerUser } from "../api/auth.api";

export default function Signup() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!username.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);

      await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      });

      setSuccess(
        "Account created successfully. Redirecting to sign in...",
      );

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1200);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(
          "Unable to create your account. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#f5f7fb",
      }}
    >
      {/* LEFT BRAND */}
      <Box
        sx={{
          display: {
            xs: "none",
            md: "flex",
          },
          width: "46%",
          minHeight: "100vh",
          bgcolor: "#0f172a",
          color: "white",
          p: {
            md: 6,
            lg: 8,
          },
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.5,
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StorageOutlinedIcon />
            </Box>

            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700 }}
              >
                Offline RAG
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                AI Platform
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 12, maxWidth: 520 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                lineHeight: 1.15,
                mb: 3,
              }}
            >
              Build a private
              <br />
              knowledge workspace.
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.8,
              }}
            >
              Upload your organization's documents and
              interact with them using secure,
              self-hosted AI.
            </Typography>
          </Box>

          <Stack spacing={2.5} sx={{ mt: 7 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <SecurityOutlinedIcon
                sx={{ color: "#60a5fa" }}
              />

              <Box>
                <Typography sx={{ fontWeight: 600 }}>
                  Secure authentication
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Protected access to your workspace
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <StorageOutlinedIcon
                sx={{ color: "#60a5fa" }}
              />

              <Box>
                <Typography sx={{ fontWeight: 600 }}>
                  Private document intelligence
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Your data remains within the platform
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Offline Retrieval-Augmented Generation AI Platform
        </Typography>
      </Box>

      {/* SIGNUP */}
      <Box
        sx={{
          flex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: {
            xs: 2,
            sm: 4,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 460,
            p: {
              xs: 3,
              sm: 5,
            },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.5,
                  bgcolor: "primary.main",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 3,
                }}
              >
                <PersonAddOutlinedIcon />
              </Box>

              <Typography
                variant="h4"
                sx={{
                  fontSize: {
                    xs: 28,
                    sm: 32,
                  },
                }}
              >
                Create your account
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                Set up your account to access the
                document intelligence workspace.
              </Typography>
            </Box>

            {error && (
              <Alert
                severity="error"
                onClose={() => setError("")}
              >
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success">
                {success}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit}
            >
              <Stack spacing={2.2}>
                <TextField
                  label="Username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  fullWidth
                  required
                  disabled={isSubmitting}
                />

                <TextField
                  label="Email address"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  fullWidth
                  required
                  disabled={isSubmitting}
                />

                <TextField
                  label="Password"
                  placeholder="Create a password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  fullWidth
                  required
                  disabled={isSubmitting}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() =>
                              setShowPassword(
                                (current) => !current,
                              )
                            }
                            edge="end"
                          >
                            {showPassword ? (
                              <VisibilityOffOutlinedIcon />
                            ) : (
                              <VisibilityOutlinedIcon />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  label="Confirm password"
                  placeholder="Re-enter your password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  fullWidth
                  required
                  disabled={isSubmitting}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() =>
                              setShowConfirmPassword(
                                (current) => !current,
                              )
                            }
                            edge="end"
                          >
                            {showConfirmPassword ? (
                              <VisibilityOffOutlinedIcon />
                            ) : (
                              <VisibilityOutlinedIcon />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={isSubmitting}
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? (
                    <CircularProgress
                      size={24}
                      color="inherit"
                    />
                  ) : (
                    "Create account"
                  )}
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center" }}
            >
              Already have an account?{" "}
              <Box
                component="span"
                onClick={() => navigate("/login")}
                sx={{
                  color: "primary.main",
                  fontWeight: 700,
                  cursor: "pointer",
                  "&:hover": {
                    textDecoration: "underline",
                  },
                }}
              >
                Sign in
              </Box>
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: "center" }}
            >
              By creating an account, you get access to
              your tenant workspace.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}