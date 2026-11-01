import { useEffect, useState } from "react";
import { Alert, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getLicenseStatus, type LicenseStatusResponse } from "../../api/license.api";
import { useAuth } from "../../auth/AuthContext";

const DISMISS_KEY = "ragentis.licenceBannerDismissed";

/**
 * Licence reminder at the top of every page.
 * Administrators see expiry warnings (30 / 15 / 7 days) and problems;
 * everyone sees it when the system is read-only.
 */
export default function LicenseBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    const load = () =>
      getLicenseStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const warning = status?.warning;
  if (!warning) return null;
  if (!isAdmin && !status?.read_only) return null;
  // Info-level reminders can be hidden for this session; serious ones stay.
  const key = `${status?.state}:${status?.days_left}`;
  if (warning.level === "info" && dismissed === key) return null;

  const text = isAdmin
    ? warning.message
    : "The licence has expired. You can still open and export your data; uploads and questions are paused. Please contact your administrator.";

  return (
    <Alert
      severity={warning.level === "critical" ? "error" : warning.level === "warning" ? "warning" : "info"}
      data-testid="licence-banner"
      sx={{ borderRadius: 2, mb: 2 }}
      onClose={
        warning.level === "info"
          ? () => {
              setDismissed(key);
              try {
                sessionStorage.setItem(DISMISS_KEY, key);
              } catch {
                /* private window: dismiss for this page view only */
              }
            }
          : undefined
      }
      action={
        isAdmin ? (
          <Button color="inherit" size="small" onClick={() => navigate("/license")}>
            Open licence
          </Button>
        ) : undefined
      }
    >
      {text}
    </Alert>
  );
}
