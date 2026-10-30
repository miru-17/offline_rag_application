import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  Add,
  AdminPanelSettings,
  DeleteOutlined,
  EditOutlined,
  GroupOutlined,
  MoreVert,
  Visibility,
  VisibilityOff,
  SearchOutlined,
} from "@mui/icons-material";

import { useAuth } from "../auth/AuthContext";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUserRole,
  updateUserStatus,
  type ManagedUser,
} from "../api/users.api";

type Role = "ADMIN" | "USER" | "VIEWER";

const ROLE_OPTIONS: Role[] = ["ADMIN", "USER", "VIEWER"];

const ROLE_CONFIG: Record<Role, { label: string; description: string }> = {
  ADMIN: {
    label: "Administrator",
    description: "Full system configuration, user provisioning, and license controls",
  },
  USER: {
    label: "Knowledge Worker",
    description: "Uploads documents and conducts reasoning queries in the AI workspace",
  },
  VIEWER: {
    label: "Auditor / Viewer",
    description: "Read-only access to view document library and query intelligence",
  },
};

function getInitials(username: string): string {
  const parts = username.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function Users() {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Add user dialog
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<Role>("USER");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Action menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<Role>("USER");
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to load users.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "ADMIN").length,
      users: users.filter((u) => u.role === "USER").length,
      viewers: users.filter((u) => u.role === "VIEWER").length,
    };
  }, [users]);

  const resetAddForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setShowPassword(false);
  };

  const handleCreateUser = async () => {
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setIsCreating(true);
      setError("");
      const newUser = await createUser({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      });

      setUsers((prev) => [...prev, newUser]);
      setAddDialogOpen(false);
      resetAddForm();
      setSuccessMessage(`User "${newUser.username}" provisioned successfully.`);
      setSnackbarOpen(true);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to provision user.";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleMenuOpen = (event: MouseEvent<HTMLElement>, managedUser: ManagedUser) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUser(managedUser);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleOpenRoleDialog = () => {
    if (!selectedUser) return;
    setSelectedRole(selectedUser.role);
    setRoleDialogOpen(true);
    handleMenuClose();
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    try {
      setIsUpdatingRole(true);
      setError("");

      const updated = await updateUserRole(selectedUser.id, { role: selectedRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u)),
      );

      setRoleDialogOpen(false);
      setSuccessMessage(`Role for "${selectedUser.username}" updated to ${selectedRole}.`);
      setSnackbarOpen(true);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to update user role.";
      setError(message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedUser) return;
    const target = selectedUser;
    handleMenuClose();
    try {
      setError("");
      const updated = await updateUserStatus(target.id, !(target.is_active ?? true));
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccessMessage(`"${updated.username}" ${updated.is_active ? "activated" : "deactivated — their sessions have ended"}.`);
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to change account status.");
    }
  };

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setIsDeleting(true);
      setError("");

      await deleteUser(selectedUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setDeleteDialogOpen(false);
      setSuccessMessage(`User "${selectedUser.username}" removed.`);
      setSnackbarOpen(true);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to delete user.";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (!isAdmin) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <Card sx={{ maxWidth: 480, p: 4, textAlign: "center", borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <AdminPanelSettings sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>
            Administrator Access Required
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Only administrators are authorized to manage user accounts and modify tenant role permissions.
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {/* HEADER */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.025em" }}>
              Access Governance & User Directory
            </Typography>
            <Chip
              label="RBAC ENFORCED"
              size="small"
              sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 700, bgcolor: "action.hover" }}
            />
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage identity entitlements and role-based access for your local tenant.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            resetAddForm();
            setAddDialogOpen(true);
          }}
          sx={{ borderRadius: 2, px: 2.5 }}
        >
          Provision User
        </Button>
      </Box>

      {/* ERROR */}
      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* METRICS STRIP */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                TOTAL ACCOUNTS
              </Typography>
              <Typography variant="h4" className="font-mono" sx={{ fontWeight: 800, mt: 0.5 }}>
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                ADMINISTRATORS
              </Typography>
              <Typography variant="h4" className="font-mono" sx={{ fontWeight: 800, mt: 0.5, color: "secondary.main" }}>
                {stats.admins}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                KNOWLEDGE WORKERS
              </Typography>
              <Typography variant="h4" className="font-mono" sx={{ fontWeight: 800, mt: 0.5, color: "primary.main" }}>
                {stats.users}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                READ AUDITORS
              </Typography>
              <Typography variant="h4" className="font-mono" sx={{ fontWeight: 800, mt: 0.5, color: "info.main" }}>
                {stats.viewers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* USER TABLE */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ mb: 2.5, maxWidth: 360 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search user or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchOutlined sx={{ fontSize: 18, color: "text.disabled", mr: 1 }} />
                  ),
                },
              }}
            />
          </Box>

          {isLoading ? (
            <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <GroupOutlined sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No users found.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Assigned Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((managedUser) => {
                    const isSelf = managedUser.id === currentUserId;

                    return (
                      <TableRow key={managedUser.id} hover>
                        {/* USER AVATAR & NAME */}
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar
                              sx={{
                                width: 34,
                                height: 34,
                                background:
                                  managedUser.role === "ADMIN"
                                    ? "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
                                    : "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              {getInitials(managedUser.username)}
                            </Avatar>

                            <Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                                  {managedUser.username}
                                </Typography>
                                {isSelf && (
                                  <Chip label="YOU" size="small" sx={{ height: 18, fontSize: "0.625rem", fontWeight: 700 }} />
                                )}
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* EMAIL */}
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {managedUser.email}
                            {managedUser.is_active === false && " · Deactivated"}
                            {managedUser.groups && managedUser.groups.length > 0 && ` · ${managedUser.groups.join(", ")}`}
                          </Typography>
                        </TableCell>

                        {/* ROLE CHIP */}
                        <TableCell>
                          <Chip
                            label={managedUser.role}
                            size="small"
                            color={
                              managedUser.role === "ADMIN"
                                ? "secondary"
                                : managedUser.role === "VIEWER"
                                  ? "info"
                                  : "primary"
                            }
                            variant="outlined"
                            sx={{ fontWeight: 700, height: 22 }}
                          />
                        </TableCell>

                        {/* ACTIONS */}
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, managedUser)}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* ROW ACTION MENU */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160 } } }}
      >
        <MenuItem onClick={handleOpenRoleDialog} sx={{ fontSize: "0.85rem" }}>
          <EditOutlined fontSize="small" sx={{ mr: 1.5, color: "text.secondary" }} />
          Modify Role
        </MenuItem>

        {selectedUser?.id !== currentUserId && (
          <MenuItem onClick={() => void handleToggleActive()} sx={{ fontSize: "0.85rem" }}>
            {selectedUser?.is_active === false ? "Activate account" : "Deactivate account"}
          </MenuItem>
        )}

        {selectedUser?.id !== currentUserId && (
          <MenuItem
            onClick={handleOpenDeleteDialog}
            sx={{ fontSize: "0.85rem", color: "error.main" }}
          >
            <DeleteOutlined fontSize="small" sx={{ mr: 1.5 }} />
            Revoke Access
          </MenuItem>
        )}
      </Menu>

      {/* PROVISION USER DIALOG */}
      <Dialog
        open={addDialogOpen}
        onClose={() => !isCreating && setAddDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Provision New User</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isCreating}
            />
            <TextField
              fullWidth
              size="small"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isCreating}
            />
            <TextField
              fullWidth
              size="small"
              label="Initial Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isCreating}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword((prev) => !prev)}>
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="role-select-label">Assigned Role</InputLabel>
              <Select
                labelId="role-select-label"
                label="Assigned Role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={isCreating}
              >
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {ROLE_CONFIG[r].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCreateUser()}
            disabled={isCreating}
            startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : <Add />}
          >
            {isCreating ? "Provisioning..." : "Provision User"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODIFY ROLE DIALOG */}
      <Dialog
        open={roleDialogOpen}
        onClose={() => !isUpdatingRole && setRoleDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Modify Entitlement Role</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Update permissions for <strong>{selectedUser?.username}</strong>.
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel id="mod-role-label">Role</InputLabel>
            <Select
              labelId="mod-role-label"
              label="Role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              disabled={isUpdatingRole}
            >
              {ROLE_OPTIONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_CONFIG[r].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: "action.hover" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary", display: "block" }}>
              {ROLE_CONFIG[selectedRole].label} Permissions:
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ROLE_CONFIG[selectedRole].description}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRoleDialogOpen(false)} disabled={isUpdatingRole}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleUpdateRole()}
            disabled={isUpdatingRole}
          >
            {isUpdatingRole ? "Updating..." : "Save Role"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE USER CONFIRMATION */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Revoke User Access?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to revoke access for <strong>{selectedUser?.username}</strong>?
            This user will no longer be able to log in to this tenant partition.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleDeleteUser()}
            disabled={isDeleting}
          >
            {isDeleting ? "Revoking..." : "Revoke Access"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message={successMessage}
      />
    </Stack>
  );
}