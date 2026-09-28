import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
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
  Tooltip,
  Typography,
} from "@mui/material";

import {
  Add,
  AdminPanelSettings,
  DeleteOutlined,
  EditOutlined,
  GroupOutlined,
  MoreVert,
  PersonOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import { useAuth } from "../auth/AuthContext";

import {
  createUser,
  deleteUser,
  getUsers,
  updateUserRole,
  type ManagedUser,
} from "../api/users.api";

type Role = "ADMIN" | "USER" | "VIEWER";

const ROLE_OPTIONS: Role[] = [
  "ADMIN",
  "USER",
  "VIEWER",
];

const ROLE_CONFIG: Record<
  Role,
  {
    label: string;
    description: string;
  }
> = {
  ADMIN: {
    label: "Administrator",
    description:
      "Full system and user management access",
  },
  USER: {
    label: "User",
    description:
      "Can manage documents and use AI workspace",
  },
  VIEWER: {
    label: "Viewer",
    description:
      "Read-only access to documents and AI workspace",
  },
};

function getInitials(username: string): string {
  const parts = username.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function getRoleIcon(role: Role): ReactElement {
  switch (role) {
    case "ADMIN":
      return (
        <AdminPanelSettings fontSize="small" />
      );

    case "VIEWER":
      return <Visibility fontSize="small" />;

    default:
      return <PersonOutlined fontSize="small" />;
  }
}

function getRoleChipStyles(role: Role) {
  switch (role) {
    case "ADMIN":
      return {
        color: "#7c3aed",
        backgroundColor:
          "rgba(124, 58, 237, 0.10)",
        borderColor:
          "rgba(124, 58, 237, 0.25)",
      };

    case "VIEWER":
      return {
        color: "#0284c7",
        backgroundColor:
          "rgba(2, 132, 199, 0.10)",
        borderColor:
          "rgba(2, 132, 199, 0.25)",
      };

    default:
      return {
        color: "#059669",
        backgroundColor:
          "rgba(5, 150, 105, 0.10)",
        borderColor:
          "rgba(5, 150, 105, 0.25)",
      };
  }
}

export default function Users() {
  const { user } = useAuth();

  const currentUserId = user?.id;

  const isAdmin =
    user?.role?.toUpperCase() === "ADMIN";

  const [users, setUsers] = useState<
    ManagedUser[]
  >([]);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const [successMessage, setSuccessMessage] =
    useState<string>("");

  /* =========================
     ADD USER
  ========================= */

  const [addDialogOpen, setAddDialogOpen] =
    useState<boolean>(false);

  const [username, setUsername] =
    useState<string>("");

  const [email, setEmail] =
    useState<string>("");

  const [password, setPassword] =
    useState<string>("");

  const [role, setRole] =
    useState<Role>("USER");

  const [showPassword, setShowPassword] =
    useState<boolean>(false);

  const [isCreating, setIsCreating] =
    useState<boolean>(false);

  /* =========================
     ACTION MENU
  ========================= */

  const [menuAnchorEl, setMenuAnchorEl] =
    useState<HTMLElement | null>(null);

  const [selectedUser, setSelectedUser] =
    useState<ManagedUser | null>(null);

  /* =========================
     ROLE DIALOG
  ========================= */

  const [roleDialogOpen, setRoleDialogOpen] =
    useState<boolean>(false);

  const [selectedRole, setSelectedRole] =
    useState<Role>("USER");

  const [isUpdatingRole, setIsUpdatingRole] =
    useState<boolean>(false);

  /* =========================
     DELETE DIALOG
  ========================= */

  const [deleteDialogOpen, setDeleteDialogOpen] =
    useState<boolean>(false);

  const [isDeleting, setIsDeleting] =
    useState<boolean>(false);

  const [snackbarOpen, setSnackbarOpen] =
    useState<boolean>(false);

  /* =========================
     LOAD USERS
  ========================= */

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
      const message =
        err?.response?.data?.detail ||
        "Failed to load users.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /* =========================
     STATS
  ========================= */

  const stats = useMemo(() => {
    return {
      total: users.length,

      admins: users.filter(
        (item) => item.role === "ADMIN",
      ).length,

      users: users.filter(
        (item) => item.role === "USER",
      ).length,

      viewers: users.filter(
        (item) => item.role === "VIEWER",
      ).length,
    };
  }, [users]);

  /* =========================
     ADD USER HANDLERS
  ========================= */

  const resetAddForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setShowPassword(false);
  };

  const handleOpenAddDialog = () => {
    resetAddForm();
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    if (isCreating) {
      return;
    }

    setAddDialogOpen(false);
    resetAddForm();
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

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters.",
      );
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

      setUsers((currentUsers) => [
        ...currentUsers,
        newUser,
      ]);

      setAddDialogOpen(false);
      resetAddForm();

      setSuccessMessage(
        `User "${newUser.username}" was created successfully.`,
      );

      setSnackbarOpen(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        "Failed to create user.";

      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  /* =========================
     ACTION MENU
  ========================= */

  const handleMenuOpen = (
    event: MouseEvent<HTMLElement>,
    managedUser: ManagedUser,
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUser(managedUser);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  /* =========================
     ROLE UPDATE
  ========================= */

  const handleOpenRoleDialog = () => {
    if (!selectedUser) {
      return;
    }

    setSelectedRole(selectedUser.role);
    setRoleDialogOpen(true);
    handleMenuClose();
  };

  const handleCloseRoleDialog = () => {
    if (isUpdatingRole) {
      return;
    }

    setRoleDialogOpen(false);
    setSelectedUser(null);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) {
      return;
    }

    if (selectedUser.id === currentUserId) {
      setError(
        "You cannot change your own role.",
      );
      return;
    }

    try {
      setIsUpdatingRole(true);
      setError("");

      const updatedUser =
        await updateUserRole(
          selectedUser.id,
          {
            role: selectedRole,
          },
        );

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === updatedUser.id
            ? updatedUser
            : item,
        ),
      );

      setRoleDialogOpen(false);
      setSelectedUser(null);

      setSuccessMessage(
        `Role updated for "${updatedUser.username}".`,
      );

      setSnackbarOpen(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        "Failed to update user role.";

      setError(message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  /* =========================
     DELETE USER
  ========================= */

  const handleOpenDeleteDialog = () => {
    if (!selectedUser) {
      return;
    }

    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleCloseDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      return;
    }

    if (selectedUser.id === currentUserId) {
      setError(
        "You cannot delete your own account.",
      );
      return;
    }

    try {
      setIsDeleting(true);
      setError("");

      await deleteUser(selectedUser.id);

      setUsers((currentUsers) =>
        currentUsers.filter(
          (item) =>
            item.id !== selectedUser.id,
        ),
      );

      setDeleteDialogOpen(false);

      setSuccessMessage(
        `User "${selectedUser.username}" was deleted successfully.`,
      );

      setSnackbarOpen(true);

      setSelectedUser(null);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        "Failed to delete user.";

      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  /* =========================
     ADMIN PROTECTION
  ========================= */

  if (!isAdmin) {
    return (
      <Box
        sx={{
          minHeight:
            "calc(100vh - 80px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 520,
            p: {
              xs: 4,
              sm: 5,
            },
            borderRadius: 4,
            textAlign: "center",
            border:
              "1px solid rgba(15, 23, 42, 0.08)",
            background:
              "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Avatar
            sx={{
              width: 72,
              height: 72,
              mx: "auto",
              mb: 2.5,
              backgroundColor:
                "rgba(124, 58, 237, 0.10)",
              color: "#7c3aed",
            }}
          >
            <AdminPanelSettings
              sx={{ fontSize: 36 }}
            />
          </Avatar>

          <Typography
            variant="h5"
            sx={{
              mb: 1,
              fontWeight: 800,
            }}
          >
            Admin Access Required
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
          >
            User management is available only
            to administrators.
          </Typography>
        </Paper>
      </Box>
    );
  }

  /* =========================
     MAIN PAGE
  ========================= */

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1500,
        mx: "auto",
        px: {
          xs: 2,
          sm: 3,
          lg: 4,
        },
        py: {
          xs: 2,
          sm: 3,
        },
      }}
    >
      {/* HEADER */}

      <Box
        sx={{
          display: "flex",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          justifyContent:
            "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              mb: 0.75,
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, #312e81 0%, #7c3aed 100%)",
                color: "#fff",
                boxShadow:
                  "0 8px 24px rgba(79, 70, 229, 0.25)",
              }}
            >
              <GroupOutlined />
            </Box>

            <Typography
              variant="h4"
              sx={{
                color: "#0f172a",
                letterSpacing: "-0.5px",
                fontWeight: 800,
              }}
            >
              Users
            </Typography>
          </Box>

          <Typography
            variant="body1"
            color="text.secondary"
          >
            Manage users, roles, and access
            within your organization.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenAddDialog}
          sx={{
            borderRadius: 2.5,
            px: 2.5,
            py: 1.2,
            fontWeight: 700,
            textTransform: "none",
            boxShadow:
              "0 8px 22px rgba(79, 70, 229, 0.20)",
            background:
              "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            "&:hover": {
              background:
                "linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)",
            },
          }}
        >
          Add User
        </Button>
      </Box>

      {/* ERROR */}

      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
          sx={{
            mb: 3,
            borderRadius: 2.5,
          }}
        >
          {error}
        </Alert>
      )}

      {/* STATS */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        {/* TOTAL */}

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border:
              "1px solid rgba(15, 23, 42, 0.07)",
            background:
              "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
            }}
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Total Users
              </Typography>

              <Typography
                variant="h4"
                sx={{
                  mt: 0.5,
                  fontWeight: 800,
                }}
              >
                {stats.total}
              </Typography>
            </Box>

            <Avatar
              sx={{
                backgroundColor:
                  "rgba(79, 70, 229, 0.10)",
                color: "#4f46e5",
              }}
            >
              <GroupOutlined />
            </Avatar>
          </Box>
        </Paper>

        {/* ADMINS */}

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border:
              "1px solid rgba(15, 23, 42, 0.07)",
            background:
              "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
            }}
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Administrators
              </Typography>

              <Typography
                variant="h4"
                sx={{
                  mt: 0.5,
                  fontWeight: 800,
                }}
              >
                {stats.admins}
              </Typography>
            </Box>

            <Avatar
              sx={{
                backgroundColor:
                  "rgba(124, 58, 237, 0.10)",
                color: "#7c3aed",
              }}
            >
              <AdminPanelSettings />
            </Avatar>
          </Box>
        </Paper>

        {/* USERS */}

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border:
              "1px solid rgba(15, 23, 42, 0.07)",
            background:
              "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
            }}
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Users
              </Typography>

              <Typography
                variant="h4"
                sx={{
                  mt: 0.5,
                  fontWeight: 800,
                }}
              >
                {stats.users}
              </Typography>
            </Box>

            <Avatar
              sx={{
                backgroundColor:
                  "rgba(5, 150, 105, 0.10)",
                color: "#059669",
              }}
            >
              <PersonOutlined />
            </Avatar>
          </Box>
        </Paper>

        {/* VIEWERS */}

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border:
              "1px solid rgba(15, 23, 42, 0.07)",
            background:
              "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
            }}
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Viewers
              </Typography>

              <Typography
                variant="h4"
                sx={{
                  mt: 0.5,
                  fontWeight: 800,
                }}
              >
                {stats.viewers}
              </Typography>
            </Box>

            <Avatar
              sx={{
                backgroundColor:
                  "rgba(2, 132, 199, 0.10)",
                color: "#0284c7",
              }}
            >
              <Visibility />
            </Avatar>
          </Box>
        </Paper>
      </Box>

      {/* USERS TABLE */}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border:
            "1px solid rgba(15, 23, 42, 0.07)",
          backgroundColor: "#fff",
        }}
      >
        <Box
          sx={{
            px: {
              xs: 2,
              sm: 3,
            },
            py: 2.2,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
              }}
            >
              Organization Users
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.3 }}
            >
              Users belonging to your current
              tenant
            </Typography>
          </Box>

          <Chip
            label={`${users.length} ${
              users.length === 1
                ? "user"
                : "users"
            }`}
            size="small"
            sx={{
              fontWeight: 700,
              backgroundColor:
                "rgba(79, 70, 229, 0.08)",
              color: "#4f46e5",
            }}
          />
        </Box>

        <Divider />

        {isLoading ? (
          <Box
            sx={{
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <CircularProgress
              size={32}
              thickness={4}
            />

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Loading users...
            </Typography>
          </Box>
        ) : users.length === 0 ? (
          <Box
            sx={{
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              px: 3,
              textAlign: "center",
            }}
          >
            <Avatar
              sx={{
                width: 60,
                height: 60,
                mb: 2,
                backgroundColor:
                  "rgba(79, 70, 229, 0.08)",
                color: "#4f46e5",
              }}
            >
              <GroupOutlined />
            </Avatar>

            <Typography
              variant="h6"
              sx={{ fontWeight: 700 }}
            >
              No users found
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                mb: 2,
              }}
            >
              Add your first organization user
              to get started.
            </Typography>

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={
                handleOpenAddDialog
              }
              sx={{
                textTransform: "none",
                borderRadius: 2,
              }}
            >
              Add User
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor:
                      "#f8fafc",
                  }}
                >
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      color: "#475569",
                      py: 1.8,
                    }}
                  >
                    User
                  </TableCell>

                  <TableCell
                    sx={{
                      fontWeight: 800,
                      color: "#475569",
                      py: 1.8,
                    }}
                  >
                    Email
                  </TableCell>

                  <TableCell
                    sx={{
                      fontWeight: 800,
                      color: "#475569",
                      py: 1.8,
                    }}
                  >
                    Role
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 800,
                      color: "#475569",
                      py: 1.8,
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {users.map(
                  (managedUser) => {
                    const userRole =
                      managedUser.role as Role;

                    const isCurrentUser =
                      managedUser.id ===
                      currentUserId;

                    const roleStyles =
                      getRoleChipStyles(
                        userRole,
                      );

                    return (
                      <TableRow
                        key={managedUser.id}
                        hover
                        sx={{
                          "&:last-child td": {
                            borderBottom: 0,
                          },
                        }}
                      >
                        <TableCell
                          sx={{
                            py: 2,
                            minWidth: 220,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems:
                                "center",
                              gap: 1.5,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 40,
                                height: 40,
                                fontSize: 14,
                                fontWeight: 800,
                                background:
                                  "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                              }}
                            >
                              {getInitials(
                                managedUser.username,
                              )}
                            </Avatar>

                            <Box
                              sx={{
                                minWidth: 0,
                              }}
                            >
                              <Box
                                sx={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 0.8,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{
                                    fontWeight:
                                      750,
                                  }}
                                >
                                  {
                                    managedUser.username
                                  }
                                </Typography>

                                {isCurrentUser && (
                                  <Chip
                                    label="You"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: 10,
                                      fontWeight: 800,
                                      backgroundColor:
                                        "rgba(79, 70, 229, 0.08)",
                                      color:
                                        "#4f46e5",
                                    }}
                                  />
                                )}
                              </Box>

                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Organization
                                member
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell
                          sx={{
                            py: 2,
                            color: "#475569",
                          }}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                          >
                            {
                              managedUser.email
                            }
                          </Typography>
                        </TableCell>

                        <TableCell
                          sx={{ py: 2 }}
                        >
                          <Chip
                            icon={getRoleIcon(
                              userRole,
                            )}
                            label={
                              ROLE_CONFIG[
                                userRole
                              ]?.label ??
                              userRole
                            }
                            size="small"
                            variant="outlined"
                            sx={{
                              fontWeight: 700,
                              borderColor:
                                roleStyles.borderColor,
                              color:
                                roleStyles.color,
                              backgroundColor:
                                roleStyles.backgroundColor,
                              "& .MuiChip-icon":
                                {
                                  color:
                                    roleStyles.color,
                                },
                            }}
                          />
                        </TableCell>

                        <TableCell
                          align="right"
                          sx={{ py: 2 }}
                        >
                          <Tooltip
                            title={
                              isCurrentUser
                                ? "You cannot modify your own account"
                                : "User actions"
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={
                                  isCurrentUser
                                }
                                onClick={(
                                  event,
                                ) =>
                                  handleMenuOpen(
                                    event,
                                    managedUser,
                                  )
                                }
                                sx={{
                                  border:
                                    "1px solid rgba(15, 23, 42, 0.08)",
                                  borderRadius: 2,
                                }}
                              >
                                <MoreVert fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ACTION MENU */}

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        slotProps={{
          paper: {
            elevation: 8,
            sx: {
              mt: 1,
              minWidth: 190,
              borderRadius: 2.5,
              border:
                "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow:
                "0 14px 35px rgba(15, 23, 42, 0.12)",
            },
          },
        }}
      >
        <MenuItem
          onClick={
            handleOpenRoleDialog
          }
          sx={{
            gap: 1.2,
            py: 1.2,
          }}
        >
          <EditOutlined
            fontSize="small"
            sx={{ color: "#4f46e5" }}
          />

          Change Role
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={
            handleOpenDeleteDialog
          }
          sx={{
            gap: 1.2,
            py: 1.2,
            color: "#dc2626",
          }}
        >
          <DeleteOutlined fontSize="small" />

          Delete User
        </MenuItem>
      </Menu>

      {/* ADD USER DIALOG */}

      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              overflow: "hidden",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            fontWeight: 800,
          }}
        >
          Add New User
        </DialogTitle>

        <DialogContent>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Create a user account and assign
            an appropriate access role.
          </Typography>

          <Stack spacing={2.2}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value,
                )
              }
              disabled={isCreating}
              autoComplete="off"
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              disabled={isCreating}
              autoComplete="off"
            />

            <TextField
              fullWidth
              label="Password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              disabled={isCreating}
              autoComplete="new-password"
              helperText="Minimum 6 characters"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowPassword(
                            (current) =>
                              !current,
                          )
                        }
                        edge="end"
                        disabled={
                          isCreating
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <FormControl fullWidth>
              <InputLabel id="new-user-role-label">
                Role
              </InputLabel>

              <Select
                labelId="new-user-role-label"
                value={role}
                label="Role"
                onChange={(event) =>
                  setRole(
                    event.target
                      .value as Role,
                  )
                }
                disabled={isCreating}
              >
                {ROLE_OPTIONS.map(
                  (roleOption) => (
                    <MenuItem
                      key={roleOption}
                      value={roleOption}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: 1.2,
                        }}
                      >
                        {getRoleIcon(
                          roleOption,
                        )}

                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight:
                                700,
                            }}
                          >
                            {
                              ROLE_CONFIG[
                                roleOption
                              ].label
                            }
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {
                              ROLE_CONFIG[
                                roleOption
                              ].description
                            }
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
            gap: 1,
          }}
        >
          <Button
            onClick={
              handleCloseAddDialog
            }
            disabled={isCreating}
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handleCreateUser
            }
            disabled={isCreating}
            startIcon={
              isCreating ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <Add />
              )
            }
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 2,
            }}
          >
            {isCreating
              ? "Creating..."
              : "Create User"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CHANGE ROLE DIALOG */}

      <Dialog
        open={roleDialogOpen}
        onClose={
          handleCloseRoleDialog
        }
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
          }}
        >
          Change User Role
        </DialogTitle>

        <DialogContent>
          {selectedUser && (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  mb: 3,
                  p: 1.5,
                  borderRadius: 2.5,
                  backgroundColor:
                    "#f8fafc",
                }}
              >
                <Avatar
                  sx={{
                    width: 42,
                    height: 42,
                    fontWeight: 800,
                    background:
                      "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  }}
                >
                  {getInitials(
                    selectedUser.username,
                  )}
                </Avatar>

                <Box>
                  <Typography
                    sx={{
                      fontWeight: 750,
                    }}
                  >
                    {
                      selectedUser.username
                    }
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    {
                      selectedUser.email
                    }
                  </Typography>
                </Box>
              </Box>

              <FormControl fullWidth>
                <InputLabel id="change-role-label">
                  Role
                </InputLabel>

                <Select
                  labelId="change-role-label"
                  value={selectedRole}
                  label="Role"
                  onChange={(event) =>
                    setSelectedRole(
                      event.target
                        .value as Role,
                    )
                  }
                  disabled={
                    isUpdatingRole
                  }
                >
                  {ROLE_OPTIONS.map(
                    (roleOption) => (
                      <MenuItem
                        key={roleOption}
                        value={roleOption}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: 1.2,
                          }}
                        >
                          {getRoleIcon(
                            roleOption,
                          )}

                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                ROLE_CONFIG[
                                  roleOption
                                ].label
                              }
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {
                                ROLE_CONFIG[
                                  roleOption
                                ].description
                              }
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
            gap: 1,
          }}
        >
          <Button
            onClick={
              handleCloseRoleDialog
            }
            disabled={isUpdatingRole}
            sx={{
              textTransform: "none",
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handleUpdateRole
            }
            disabled={isUpdatingRole}
            startIcon={
              isUpdatingRole ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <EditOutlined />
              )
            }
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
            }}
          >
            {isUpdatingRole
              ? "Updating..."
              : "Update Role"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}

      <Dialog
        open={deleteDialogOpen}
        onClose={
          handleCloseDeleteDialog
        }
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
          }}
        >
          Delete User?
        </DialogTitle>

        <DialogContent>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            Are you sure you want to delete{" "}
            <Box
              component="span"
              sx={{
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {selectedUser?.username}
            </Box>
            ? This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
            gap: 1,
          }}
        >
          <Button
            onClick={
              handleCloseDeleteDialog
            }
            disabled={isDeleting}
            sx={{
              textTransform: "none",
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={
              handleDeleteUser
            }
            disabled={isDeleting}
            startIcon={
              isDeleting ? (
                <CircularProgress
                  size={17}
                  color="inherit"
                />
              ) : (
                <DeleteOutlined />
              )
            }
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
            }}
          >
            {isDeleting
              ? "Deleting..."
              : "Delete User"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SUCCESS SNACKBAR */}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={
          handleSnackbarClose
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
      >
        <Alert
          onClose={
            handleSnackbarClose
          }
          severity="success"
          variant="filled"
          sx={{
            borderRadius: 2,
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}