import {
  AppBar,
  Avatar,
  Box,
  Chip,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

import { useAuth } from "../../auth/AuthContext";

interface TopbarProps {
  drawerWidth: number;
  onMenuClick: () => void;
}

export default function Topbar({
  drawerWidth,
  onMenuClick,
}: TopbarProps) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const initials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : "US";

  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="inherit"
      sx={{
        width: {
          md: `calc(100% - ${drawerWidth}px)`,
        },
        ml: {
          md: `${drawerWidth}px`,
        },
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Toolbar sx={{ minHeight: 72 }}>
        {/* Mobile menu */}
        <IconButton
          onClick={onMenuClick}
          sx={{
            display: { md: "none" },
            mr: 1,
          }}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </IconButton>

        {/* Page title */}
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{
              display: {
                xs: "none",
                sm: "block",
              },
              fontWeight: 600,
            }}
          >
            Document Intelligence Workspace
          </Typography>
        </Box>

        {user && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: {
                xs: 1,
                sm: 1.5,
              },
            }}
          >
            {/* User information */}
            <Box
              sx={{
                display: {
                  xs: "none",
                  lg: "block",
                },
                textAlign: "right",
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600 }}
              >
                {user.username}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                {user.tenant_name}
              </Typography>
            </Box>

            {/* Role */}
            <Chip
              label={user.role}
              size="small"
              variant="outlined"
              sx={{
                display: {
                  xs: "none",
                  sm: "flex",
                },
                fontWeight: 600,
              }}
            />

            {/* Avatar */}
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: "primary.main",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>

            {/* Logout */}
            <Tooltip title="Sign out">
              <IconButton
                onClick={handleLogout}
                aria-label="Sign out"
                color="inherit"
              >
                <LogoutOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}