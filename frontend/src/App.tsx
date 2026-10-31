import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

// Authenticated pages are code-split so the login screen loads quickly.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Documents = lazy(() => import("./pages/Documents"));
const AIWorkspace = lazy(() => import("./pages/AIWorkspace"));
const Users = lazy(() => import("./pages/users"));
const License = lazy(() => import("./pages/License"));
const Settings = lazy(() => import("./pages/Settings"));
const DataDashboard = lazy(() => import("./pages/DataDashboard"));
const Extraction = lazy(() => import("./pages/Extraction"));
const CompareDocuments = lazy(() => import("./pages/CompareDocuments"));
const TeamSpaces = lazy(() => import("./pages/TeamSpaces"));
const Insights = lazy(() => import("./pages/Insights"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Reports = lazy(() => import("./pages/Reports"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));

function PageFallback() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
      <CircularProgress size={22} thickness={5} />
    </Box>
  );
}

import ProtectedRoute from "./auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* ==================== PUBLIC ROUTES ==================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/signup"
        element={<Signup />}
      />

      {/* ==================== PROTECTED ROUTES ==================== */}

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          {/* ==================== DASHBOARD ==================== */}

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          {/* ==================== DOCUMENTS ==================== */}

          <Route
            path="/documents"
            element={<Documents />}
          />

          {/* ==================== AI WORKSPACE ==================== */}

          <Route
            path="/ai-workspace"
            element={<AIWorkspace />}
          />

          {/* ==================== USERS ==================== */}

          <Route
            path="/users"
            element={<Users />}
          />

          {/* ==================== LICENSE ==================== */}

          <Route
            path="/license"
            element={<License />}
          />

          <Route path="/data" element={<DataDashboard />} />
          <Route path="/data/:datasetId" element={<DataDashboard />} />
          <Route path="/extraction" element={<Extraction />} />
          <Route path="/compare" element={<CompareDocuments />} />
          <Route path="/teams" element={<TeamSpaces />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/api-keys" element={<ApiKeys />} />

          {/* ==================== SETTINGS ==================== */}

          <Route
            path="/settings"
            element={<Settings />}
          />

        </Route>
      </Route>

      {/* ==================== DEFAULT ROUTE ==================== */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      {/* ==================== UNKNOWN ROUTES ==================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
    </Suspense>
  );
}

export default App;