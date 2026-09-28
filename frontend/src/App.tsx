import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import AIWorkspace from "./pages/AIWorkspace";
import Users from "./pages/users";
import License from "./pages/License";
import Settings from "./pages/Settings";

import ProtectedRoute from "./auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

function App() {
  return (
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
  );
}

export default App;