import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import {
  AdminPanelSettingsOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  ContentCopyOutlined,
  EditOutlined,
  KeyOutlined,
  RefreshOutlined,
  ScheduleOutlined,
  SecurityOutlined,
  ShieldOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";

import { useAuth } from "../auth/AuthContext";

import {
  getLicenseStatus,
  updateLicenseExpiry,
  type LicenseStatusResponse,
} from "../api/license.api";


/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


function getDaysRemaining(
  expiresAt: string,
): number {
  const expiry =
    new Date(expiresAt).getTime();

  const now = Date.now();

  const difference = expiry - now;

  if (difference <= 0) {
    return 0;
  }

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24),
  );
}


/*
 * Converts backend ISO datetime into
 * yyyy-MM-dd format required by
 * <input type="date">
 */
function toDateInputValue(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/*
 * Converts yyyy-MM-dd into an ISO
 * datetime that the backend can accept.
 *
 * We use end-of-day UTC so the selected
 * expiry date remains valid for the
 * complete selected day.
 */
function dateInputToISO(
  value: string,
): string {
  return `${value}T23:59:59Z`;
}


/* =========================================================
   COMPONENT
========================================================= */

function License() {
  const { user } = useAuth();


  /* =======================================================
     STATE
  ======================================================= */

  const [licenseData, setLicenseData] =
    useState<LicenseStatusResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isRefreshing, setIsRefreshing] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState<boolean>(false);


  /* =======================================================
     EDIT LICENSE STATE
  ======================================================= */

  const [editOpen, setEditOpen] =
    useState<boolean>(false);

  const [newExpiryDate, setNewExpiryDate] =
    useState<string>("");

  const [isSaving, setIsSaving] =
    useState<boolean>(false);

  const [editError, setEditError] =
    useState<string | null>(null);


  /* =======================================================
     ROLE
  ======================================================= */

  const userRole =
    user?.role?.toUpperCase();

  const isAdmin =
    userRole === "ADMIN";


  /* =======================================================
     LOAD LICENSE
  ======================================================= */

  const loadLicense = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setError(null);

        const response =
          await getLicenseStatus();

        setLicenseData(response);
      } catch (err) {
        console.error(
          "Failed to load license status:",
          err,
        );

        setError(
          "Unable to load license information. Please try again.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (isAdmin) {
      void loadLicense();
    } else {
      setIsLoading(false);
    }
  }, [
    isAdmin,
    loadLicense,
  ]);


  /* =======================================================
     LICENSE
  ======================================================= */

  const license =
    licenseData?.license;


  /* =======================================================
     DAYS REMAINING
  ======================================================= */

  const daysRemaining =
    useMemo(() => {
      if (!license?.expires_at) {
        return 0;
      }

      return getDaysRemaining(
        license.expires_at,
      );
    }, [
      license?.expires_at,
    ]);


  /* =======================================================
     ACTIVE STATUS
  ======================================================= */

  const isActive =
    Boolean(
      licenseData?.licensed &&
        license?.is_active &&
        daysRemaining > 0,
    );


  /* =======================================================
     COPY LICENSE KEY
  ======================================================= */

  const handleCopy = async () => {
    if (!license?.license_key) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        license.license_key,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error(
        "Failed to copy license key:",
        err,
      );
    }
  };


  /* =======================================================
     OPEN EDIT DIALOG
  ======================================================= */

  const handleOpenEdit = () => {
    if (!license?.expires_at) {
      return;
    }

    setNewExpiryDate(
      toDateInputValue(
        license.expires_at,
      ),
    );

    setEditError(null);
    setSuccess(null);

    setEditOpen(true);
  };


  /* =======================================================
     CLOSE EDIT DIALOG
  ======================================================= */

  const handleCloseEdit = () => {
    if (isSaving) {
      return;
    }

    setEditOpen(false);
    setEditError(null);
  };


  /* =======================================================
     SAVE NEW EXPIRY
  ======================================================= */

  const handleSaveExpiry =
    async () => {
      if (!newExpiryDate) {
        setEditError(
          "Please select an expiry date.",
        );
        return;
      }

      const selectedDate =
        new Date(
          `${newExpiryDate}T23:59:59`,
        );

      const now =
        new Date();

      if (
        Number.isNaN(
          selectedDate.getTime(),
        )
      ) {
        setEditError(
          "Please select a valid expiry date.",
        );
        return;
      }

      if (
        selectedDate <= now
      ) {
        setEditError(
          "Expiry date must be in the future.",
        );
        return;
      }

      try {
        setIsSaving(true);
        setEditError(null);
        setError(null);
        setSuccess(null);

        const updatedLicense =
          await updateLicenseExpiry(
            dateInputToISO(
              newExpiryDate,
            ),
          );

        setLicenseData(
          (previous) => {
            if (!previous) {
              return previous;
            }

            return {
              ...previous,
              licensed:
                updatedLicense.is_active,
              license:
                updatedLicense,
            };
          },
        );

        setEditOpen(false);

        setSuccess(
          "License expiry date updated successfully.",
        );
      } catch (err) {
        console.error(
          "Failed to update license expiry:",
          err,
        );

        setEditError(
          "Unable to update the expiry date. Please try again.",
        );
      } finally {
        setIsSaving(false);
      }
    };


  /* =======================================================
     ACCESS RESTRICTED
  ======================================================= */

  if (!isAdmin) {
    return (
      <Box
        sx={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
          background:
            "linear-gradient(135deg, #07111f 0%, #0b1424 100%)",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 520,
            width: "100%",
            p: 4,
            borderRadius: 4,
            textAlign: "center",
            color: "#ffffff",
            background:
              "rgba(15, 23, 42, 0.94)",
            border:
              "1px solid rgba(148,163,184,0.16)",
          }}
        >
          <Box
            sx={{
              width: 68,
              height: 68,
              mx: "auto",
              mb: 2,
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "rgba(59,130,246,0.14)",
              border:
                "1px solid rgba(96,165,250,0.2)",
            }}
          >
            <SecurityOutlined
              sx={{
                fontSize: 34,
                color: "#60a5fa",
              }}
            />
          </Box>

          <Typography
            variant="h5"
            sx={{
              color: "#ffffff",
              fontWeight: 700,
              mb: 1,
            }}
          >
            Access Restricted
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: "#93c5fd",
              lineHeight: 1.7,
            }}
          >
            License management is
            available only to
            administrators.
          </Typography>
        </Paper>
      </Box>
    );
  }


  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100%",
        p: {
          xs: 2,
          sm: 3,
          lg: 4,
        },
        color: "#ffffff",
      }}
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <Box
        sx={{
          display: "flex",
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          justifyContent:
            "space-between",
          gap: 2,
          mb: 4,
          flexDirection: {
            xs: "column",
            sm: "row",
          },
        }}
      >
        <Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mb: 1,
            }}
          >

            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(34,211,238,0.10))",
                border:
                  "1px solid rgba(96,165,250,0.25)",
              }}
            >
              <ShieldOutlined
                sx={{
                  fontSize: 25,
                  color: "#60a5fa",
                }}
              />
            </Box>


            {/* ===========================================
                UPDATED LICENSE MANAGEMENT HEADING
            =========================================== */}

            <Typography
              variant="h4"
              sx={{
                fontSize: {
                  xs: "2rem",
                  sm: "2.5rem",
                  md: "2.75rem",
                },
                fontWeight: 900,
                letterSpacing: "-1px",
                lineHeight: 1.15,
                color: "#1e40af",
                textShadow:
                  "0 2px 12px rgba(30,64,175,0.18)",
              }}
            >
              License Management
            </Typography>

          </Box>


          {/* =============================================
              UPDATED DESCRIPTION
          ============================================= */}

          <Typography
            variant="body1"
            sx={{
              color: "#94a3b8",
              maxWidth: 720,
              fontSize: {
                xs: "0.95rem",
                sm: "1.05rem",
              },
              fontWeight: 600,
              lineHeight: 1.7,
              letterSpacing: "0.1px",
              textShadow:
                "0 0 18px rgba(96,165,250,0.18)",
            }}
          >
            Monitor your RAGENTIS deployment
            license, validity, and activation
            status.
          </Typography>

        </Box>


        {/* HEADER BUTTONS */}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.2,
            flexWrap: "wrap",
          }}
        >

          {license && (
            <Button
              variant="contained"
              startIcon={
                <EditOutlined />
              }
              onClick={
                handleOpenEdit
              }
              sx={{
                borderRadius: 2.5,
                textTransform: "none",
                fontWeight: 800,
                px: 2.2,
                py: 1.15,
                color: "#ffffff",

                background:
                  "linear-gradient(135deg, #2563eb, #3b82f6)",

                border:
                  "1px solid rgba(96,165,250,0.65)",

                boxShadow:
                  "0 8px 28px rgba(37,99,235,0.40)",

                "&:hover": {
                  background:
                    "linear-gradient(135deg, #1d4ed8, #2563eb)",

                  boxShadow:
                    "0 12px 36px rgba(37,99,235,0.55)",

                  transform:
                    "translateY(-1px)",
                },

                "&.Mui-disabled": {
                  color:
                    "rgba(255,255,255,0.55)",

                  background:
                    "rgba(30,41,59,0.7)",
                },

                transition:
                  "all 0.2s ease",
              }}
            >
              Manage License
            </Button>
          )}


          {/* =============================================
              UPDATED REFRESH BUTTON
          ============================================= */}

          <Button
            variant="contained"
            startIcon={
              isRefreshing ? (
                <CircularProgress
                  size={17}
                  thickness={5}
                  sx={{
                    color:
                      "#ffffff",
                  }}
                />
              ) : (
                <RefreshOutlined />
              )
            }
            onClick={() =>
              void loadLicense(
                true,
              )
            }
            disabled={
              isRefreshing ||
              isLoading
            }
            sx={{
              borderRadius: 2.5,
              textTransform: "none",
              fontWeight: 800,
              px: 2.2,
              py: 1.15,
              color: "#ffffff",

              background:
                "linear-gradient(135deg, #2563eb, #3b82f6)",

              border:
                "1px solid rgba(96,165,250,0.65)",

              boxShadow:
                "0 8px 28px rgba(37,99,235,0.40)",

              "&:hover": {
                background:
                  "linear-gradient(135deg, #1d4ed8, #2563eb)",

                boxShadow:
                  "0 12px 36px rgba(37,99,235,0.55)",

                transform:
                  "translateY(-1px)",
              },

              "&.Mui-disabled": {
                color:
                  "rgba(255,255,255,0.55)",

                background:
                  "rgba(30,41,59,0.7)",
              },

              transition:
                "all 0.2s ease",
            }}
          >
            Refresh Status
          </Button>

        </Box>
      </Box>


      {/* =================================================
          SUCCESS
      ================================================= */}

      {success && (
        <Alert
          severity="success"
          onClose={() =>
            setSuccess(null)
          }
          sx={{
            mb: 3,
            borderRadius: 2.5,
          }}
        >
          {success}
        </Alert>
      )}


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <Alert
          severity="error"
          onClose={() =>
            setError(null)
          }
          sx={{
            mb: 3,
            borderRadius: 2.5,
          }}
        >
          {error}
        </Alert>
      )}


      {/* =================================================
          LOADING
      ================================================= */}

      {isLoading ? (
        <Box
          sx={{
            minHeight: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress
            sx={{
              color: "#60a5fa",
            }}
          />
        </Box>
      ) : !licenseData?.license ? (

        /* =================================================
           NO LICENSE
        ================================================= */

        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 3,
              sm: 5,
            },
            borderRadius: 4,
            textAlign: "center",
            color: "#ffffff",
            background:
              "rgba(15,23,42,0.82)",
            border:
              "1px solid rgba(148,163,184,0.16)",
          }}
        >
          <WarningAmberOutlined
            sx={{
              fontSize: 50,
              mb: 2,
              color: "#fbbf24",
            }}
          />

          <Typography
            variant="h5"
            sx={{
              color: "#ffffff",
              fontWeight: 800,
              mb: 1,
            }}
          >
            No License Found
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: "#aebbd0",
            }}
          >
            No active RAGENTIS
            license is currently
            associated with this
            deployment.
          </Typography>
        </Paper>

      ) : license ? (

        <>

          {/* ===============================================
              STATUS HERO
          =============================================== */}

          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              mb: 3,
              p: {
                xs: 3,
                md: 4,
              },
              borderRadius: 4,
              color: "#ffffff",
              border:
                "1px solid rgba(96,165,250,0.18)",
              background:
                "linear-gradient(135deg, #0b1729 0%, #101c31 52%, #0b1424 100%)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.22)",
            }}
          >

            {/* Green / red glow */}

            <Box
              sx={{
                position:
                  "absolute",
                width: 320,
                height: 320,
                borderRadius:
                  "50%",
                right: -110,
                top: -170,
                background:
                  isActive
                    ? "rgba(34,197,94,0.13)"
                    : "rgba(239,68,68,0.13)",
                filter:
                  "blur(30px)",
              }}
            />

            <Box
              sx={{
                position:
                  "absolute",
                width: 240,
                height: 240,
                borderRadius:
                  "50%",
                left: -140,
                bottom: -170,
                background:
                  "rgba(59,130,246,0.12)",
                filter:
                  "blur(30px)",
              }}
            />


            <Box
              sx={{
                position:
                  "relative",
                display: "flex",
                alignItems: {
                  xs: "flex-start",
                  md: "center",
                },
                justifyContent:
                  "space-between",
                gap: 3,
                flexDirection: {
                  xs: "column",
                  md: "row",
                },
              }}
            >

              {/* STATUS */}

              <Box>

                <Typography
                  variant="body2"
                  sx={{
                    color:
                      "#94a3b8",
                    mb: 1,
                    fontWeight: 700,
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "1.4px",
                  }}
                >
                  License Status
                </Typography>


                <Box
                  sx={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 1.3,
                  }}
                >

                  <CheckCircleOutlined
                    sx={{
                      fontSize: 34,
                      color:
                        isActive
                          ? "#4ade80"
                          : "#f87171",
                      filter:
                        isActive
                          ? "drop-shadow(0 0 10px rgba(74,222,128,0.35))"
                          : "drop-shadow(0 0 10px rgba(248,113,113,0.35))",
                    }}
                  />

                  <Typography
                    variant="h3"
                    sx={{
                      color:
                        isActive
                          ? "#4ade80"
                          : "#f87171",
                      fontWeight: 900,
                      letterSpacing:
                        "-1px",
                      textShadow:
                        isActive
                          ? "0 0 24px rgba(74,222,128,0.18)"
                          : "0 0 24px rgba(248,113,113,0.18)",
                    }}
                  >
                    {isActive
                      ? "Active"
                      : "Expired"}
                  </Typography>

                </Box>


                <Typography
                  variant="body2"
                  sx={{
                    color:
                      "#cbd5e1",
                    mt: 1.2,
                    lineHeight: 1.7,
                    maxWidth: 560,
                  }}
                >
                  {isActive
                    ? "Your RAGENTIS deployment is licensed and operational."
                    : "Your license has expired and protected features may be unavailable."}
                </Typography>

              </Box>


              {/* DAYS */}

              <Box
                sx={{
                  minWidth: {
                    xs: "100%",
                    md: 230,
                  },
                  p: 2.7,
                  borderRadius: 3,
                  background:
                    "rgba(255,255,255,0.055)",
                  border:
                    "1px solid rgba(148,163,184,0.14)",
                  backdropFilter:
                    "blur(10px)",
                }}
              >

                <Typography
                  variant="caption"
                  sx={{
                    color:
                      "#94a3b8",
                    fontWeight: 700,
                    letterSpacing:
                      "1.2px",
                  }}
                >
                  DAYS REMAINING
                </Typography>


                <Typography
                  variant="h2"
                  sx={{
                    color:
                      "#67e8f9",
                    fontWeight: 900,
                    lineHeight: 1.1,
                    mt: 0.6,
                    textShadow:
                      "0 0 24px rgba(103,232,249,0.18)",
                  }}
                >
                  {daysRemaining}
                </Typography>


                <Typography
                  variant="caption"
                  sx={{
                    color:
                      "#cbd5e1",
                  }}
                >
                  until expiration
                </Typography>

              </Box>

            </Box>
          </Paper>


          {/* ===============================================
              DETAILS GRID
          =============================================== */}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "1.4fr 1fr",
              },
              gap: 3,
            }}
          >

            {/* =============================================
                LICENSE INFORMATION
            ============================================= */}

            <Paper
              elevation={0}
              sx={{
                p: {
                  xs: 2.5,
                  sm: 3,
                },
                borderRadius: 4,
                color: "#ffffff",
                background:
                  "rgba(15,23,42,0.78)",
                border:
                  "1px solid rgba(148,163,184,0.16)",
              }}
            >

              <Box
                sx={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 1.5,
                  mb: 2.5,
                }}
              >

                <KeyOutlined
                  sx={{
                    color:
                      "#60a5fa",
                  }}
                />

                <Typography
                  variant="h6"
                  sx={{
                    color:
                      "#f8fafc",
                    fontWeight: 800,
                  }}
                >
                  License Information
                </Typography>

              </Box>


              <Divider
                sx={{
                  mb: 2,
                  borderColor:
                    "rgba(148,163,184,0.14)",
                }}
              />


              {/* LICENSE KEY */}

              <Box sx={{ mb: 2.5 }}>

                <Typography
                  variant="caption"
                  sx={{
                    color:
                      "#94a3b8",
                    fontWeight: 700,
                    letterSpacing:
                      "1px",
                  }}
                >
                  LICENSE KEY
                </Typography>


                <Box
                  sx={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 1,
                    mt: 0.8,
                    p: 1.3,
                    borderRadius: 2,
                    background:
                      "rgba(2,6,23,0.55)",
                    border:
                      "1px solid rgba(96,165,250,0.14)",
                  }}
                >

                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      color:
                        "#f8fafc",
                      fontFamily:
                        "monospace",
                      wordBreak:
                        "break-all",
                      fontWeight: 600,
                      letterSpacing:
                        "0.2px",
                    }}
                  >
                    {
                      license.license_key
                    }
                  </Typography>


                  <Button
                    size="small"
                    onClick={
                      handleCopy
                    }
                    startIcon={
                      <ContentCopyOutlined
                        sx={{
                          fontSize:
                            17,
                        }}
                      />
                    }
                    sx={{
                      minWidth: 90,
                      textTransform:
                        "none",
                      color:
                        "#93c5fd",
                      fontWeight: 700,
                    }}
                  >
                    {copied
                      ? "Copied"
                      : "Copy"}
                  </Button>

                </Box>
              </Box>


              {/* ISSUED / EXPIRY */}

              <Box
                sx={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    {
                      xs: "1fr",
                      sm: "1fr 1fr",
                    },
                  gap: 2,
                }}
              >

                <Box
                  sx={{
                    p: 2,
                    borderRadius:
                      2.5,
                    background:
                      "rgba(148,163,184,0.055)",
                    border:
                      "1px solid rgba(148,163,184,0.08)",
                  }}
                >

                  <Typography
                    variant="caption"
                    sx={{
                      color:
                        "#94a3b8",
                      fontWeight: 700,
                      letterSpacing:
                        "0.8px",
                    }}
                  >
                    ISSUED ON
                  </Typography>


                  <Typography
                    variant="body1"
                    sx={{
                      color:
                        "#f1f5f9",
                      fontWeight: 750,
                      mt: 0.6,
                    }}
                  >
                    {formatDate(
                      license.issued_at,
                    )}
                  </Typography>

                </Box>


                <Box
                  sx={{
                    p: 2,
                    borderRadius:
                      2.5,
                    background:
                      "rgba(148,163,184,0.055)",
                    border:
                      "1px solid rgba(148,163,184,0.08)",
                  }}
                >

                  <Typography
                    variant="caption"
                    sx={{
                      color:
                        "#94a3b8",
                      fontWeight: 700,
                      letterSpacing:
                        "0.8px",
                    }}
                  >
                    EXPIRES ON
                  </Typography>


                  <Typography
                    variant="body1"
                    sx={{
                      color:
                        isActive
                          ? "#67e8f9"
                          : "#fca5a5",
                      fontWeight: 800,
                      mt: 0.6,
                    }}
                  >
                    {formatDate(
                      license.expires_at,
                    )}
                  </Typography>

                </Box>

              </Box>

            </Paper>


            {/* =============================================
                DEPLOYMENT DETAILS
            ============================================= */}

            <Paper
              elevation={0}
              sx={{
                p: {
                  xs: 2.5,
                  sm: 3,
                },
                borderRadius: 4,
                color: "#ffffff",
                background:
                  "rgba(15,23,42,0.78)",
                border:
                  "1px solid rgba(148,163,184,0.16)",
              }}
            >

              <Box
                sx={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 1.5,
                  mb: 2.5,
                }}
              >

                <AdminPanelSettingsOutlined
                  sx={{
                    color:
                      "#60a5fa",
                  }}
                />

                <Typography
                  variant="h6"
                  sx={{
                    color:
                      "#f8fafc",
                    fontWeight: 800,
                  }}
                >
                  Deployment Details
                </Typography>

              </Box>


              <Divider
                sx={{
                  mb: 2,
                  borderColor:
                    "rgba(148,163,184,0.14)",
                }}
              />


              <Box
                sx={{
                  display:
                    "grid",
                  gap: 1.5,
                }}
              >

                {/* DEPLOYMENT */}

                <Box
                  sx={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: 2,
                    p: 1.8,
                    borderRadius:
                      2.5,
                    background:
                      "rgba(148,163,184,0.055)",
                    border:
                      "1px solid rgba(148,163,184,0.07)",
                  }}
                >

                  <Box
                    sx={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 1.2,
                    }}
                  >

                    <SecurityOutlined
                      sx={{
                        fontSize:
                          20,
                        color:
                          "#60a5fa",
                      }}
                    />

                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          "#aebbd0",
                      }}
                    >
                      Deployment
                    </Typography>

                  </Box>


                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        "#f1f5f9",
                      fontWeight: 750,
                    }}
                  >
                    Self-Hosted
                  </Typography>

                </Box>


                {/* LICENSE TYPE */}

                <Box
                  sx={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: 2,
                    p: 1.8,
                    borderRadius:
                      2.5,
                    background:
                      "rgba(148,163,184,0.055)",
                    border:
                      "1px solid rgba(148,163,184,0.07)",
                  }}
                >

                  <Box
                    sx={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 1.2,
                    }}
                  >

                    <ShieldOutlined
                      sx={{
                        fontSize:
                          20,
                        color:
                          "#60a5fa",
                      }}
                    />

                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          "#aebbd0",
                      }}
                    >
                      License Type
                    </Typography>

                  </Box>


                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        "#f1f5f9",
                      fontWeight: 750,
                    }}
                  >
                    Enterprise
                  </Typography>

                </Box>


                {/* VALID UNTIL */}

                <Box
                  sx={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: 2,
                    p: 1.8,
                    borderRadius:
                      2.5,
                    background:
                      "rgba(148,163,184,0.055)",
                    border:
                      "1px solid rgba(148,163,184,0.07)",
                  }}
                >

                  <Box
                    sx={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 1.2,
                    }}
                  >

                    <ScheduleOutlined
                      sx={{
                        fontSize:
                          20,
                        color:
                          "#60a5fa",
                      }}
                    />

                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          "#aebbd0",
                      }}
                    >
                      Valid Until
                    </Typography>

                  </Box>


                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        "#67e8f9",
                      fontWeight: 800,
                    }}
                  >
                    {formatDate(
                      license.expires_at,
                    )}
                  </Typography>

                </Box>

              </Box>

            </Paper>

          </Box>
        </>

      ) : null}


      {/* =================================================
          MANAGE LICENSE DIALOG
      ================================================= */}

      <Dialog
        open={editOpen}
        onClose={
          handleCloseEdit
        }
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 4,
              background:
                "#0f172a",
              color: "#ffffff",
              border:
                "1px solid rgba(96,165,250,0.18)",
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.45)",
            },
          },
        }}
      >

        {/* DIALOG HEADER */}

        <DialogTitle
          sx={{
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            color:
              "#ffffff",
            fontWeight: 800,
            pb: 1,
          }}
        >

          <Box
            sx={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 1.2,
            }}
          >

            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius:
                  "12px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                background:
                  "rgba(59,130,246,0.14)",
                border:
                  "1px solid rgba(96,165,250,0.18)",
              }}
            >
              <EditOutlined
                sx={{
                  color:
                    "#60a5fa",
                }}
              />
            </Box>

            <Box>

              <Typography
                variant="h6"
                sx={{
                  color:
                    "#ffffff",
                  fontWeight:
                    800,
                }}
              >
                Manage License
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  color:
                    "#94a3b8",
                }}
              >
                Update license
                expiration
              </Typography>

            </Box>

          </Box>


          <IconButton
            onClick={
              handleCloseEdit
            }
            disabled={isSaving}
            sx={{
              color:
                "#94a3b8",
              "&:hover": {
                color:
                  "#ffffff",
                background:
                  "rgba(255,255,255,0.06)",
              },
            }}
          >
            <CloseOutlined />
          </IconButton>

        </DialogTitle>


        <Divider
          sx={{
            borderColor:
              "rgba(148,163,184,0.12)",
          }}
        />


        {/* DIALOG CONTENT */}

        <DialogContent
          sx={{
            pt: 3,
          }}
        >

          {editError && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: 2.5,
              }}
            >
              {editError}
            </Alert>
          )}


          <Typography
            variant="body2"
            sx={{
              color:
                "#aebbd0",
              mb: 2,
              lineHeight: 1.7,
            }}
          >
            Select a new expiration
            date for the current
            tenant license.
          </Typography>


          <TextField
            fullWidth
            type="date"
            value={newExpiryDate}
            onChange={(event) =>
              setNewExpiryDate(
                event.target.value,
              )
            }
            label="License Expiry Date"
            helperText="The selected date must be in the future."
            disabled={isSaving}
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            sx={{
              "& .MuiInputLabel-root":
                {
                  color:
                    "#94a3b8",
                },

              "& .MuiInputLabel-root.Mui-focused":
                {
                  color:
                    "#60a5fa",
                },

              "& .MuiOutlinedInput-root":
                {
                  color:
                    "#ffffff",

                  background:
                    "rgba(2,6,23,0.55)",

                  "& fieldset":
                    {
                      borderColor:
                        "rgba(148,163,184,0.24)",
                    },

                  "&:hover fieldset":
                    {
                      borderColor:
                        "rgba(96,165,250,0.45)",
                    },

                  "&.Mui-focused fieldset":
                    {
                      borderColor:
                        "#60a5fa",
                    },
                },

              "& .MuiFormHelperText-root":
                {
                  color:
                    "#94a3b8",
                },

              "& input::-webkit-calendar-picker-indicator":
                {
                  filter:
                    "invert(1)",
                  cursor:
                    "pointer",
                },
            }}
          />

        </DialogContent>


        {/* DIALOG ACTIONS */}

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            gap: 1,
          }}
        >

          <Button
            onClick={
              handleCloseEdit
            }
            disabled={isSaving}
            sx={{
              textTransform:
                "none",
              color:
                "#cbd5e1",
              fontWeight: 700,
              px: 2,
            }}
          >
            Cancel
          </Button>


          <Button
            variant="contained"
            onClick={
              handleSaveExpiry
            }
            disabled={
              isSaving ||
              !newExpiryDate
            }
            startIcon={
              isSaving ? (
                <CircularProgress
                  size={17}
                  thickness={5}
                  sx={{
                    color:
                      "#ffffff",
                  }}
                />
              ) : (
                <CheckCircleOutlined />
              )
            }
            sx={{
              textTransform:
                "none",
              fontWeight: 800,
              px: 2.5,
              borderRadius:
                2.2,
              color:
                "#ffffff",
              background:
                "linear-gradient(135deg, #2563eb, #0891b2)",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #1d4ed8, #0e7490)",
              },
            }}
          >
            {isSaving
              ? "Saving..."
              : "Save Changes"}
          </Button>

        </DialogActions>

      </Dialog>

    </Box>
  );
}

export default License;