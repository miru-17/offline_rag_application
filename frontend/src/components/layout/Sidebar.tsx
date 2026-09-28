import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";

import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  drawerWidth: number;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Array<"ADMIN" | "USER" | "VIEWER">;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <DashboardOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
  },
  {
    label: "Documents",
    path: "/documents",
    icon: <DescriptionOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
  },
  {
    label: "AI Workspace",
    path: "/ai-workspace",
    icon: <SmartToyOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
  },
  {
    label: "Users",
    path: "/users",
    icon: <PeopleOutlinedIcon />,
    roles: ["ADMIN"],
  },
  {
    label: "License",
    path: "/license",
    icon: <VerifiedOutlinedIcon />,
    roles: ["ADMIN"],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: <SettingsOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
  },
];

export default function Sidebar({
  open,
  onClose,
  drawerWidth,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = user?.role;

  const visibleNavigationItems = navigationItems.filter((item) =>
    userRole ? item.roles.includes(userRole) : false,
  );

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Brand */}
      <Box
        sx={{
          height: 72,
          display: "flex",
          alignItems: "center",
          px: 2.5,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1.5,
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            mr: 1.5,
          }}
        >
          R
        </Box>

        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700 }}
          >
            RAGENTIS
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            AI Platform
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Section label */}
      <Box sx={{ px: 2, pt: 3, pb: 1 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          Workspace
        </Typography>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 1.5 }}>
        {visibleNavigationItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);

          return (
            <ListItemButton
              key={item.path}
              selected={isActive}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mb: 0.5,
                borderRadius: 1.5,
                minHeight: 46,

                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",

                  "& .MuiListItemIcon-root": {
                    color: "inherit",
                  },

                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                },

                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 42,
                  color: isActive
                    ? "inherit"
                    : "text.secondary",
                }}
              >
                {item.icon}
              </ListItemIcon>

              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* Platform status */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
          >
            Platform
          </Typography>

          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
          >
            Offline & Self-Hosted
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{
        width: { md: drawerWidth },
        flexShrink: { md: 0 },
      }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: "block", md: "none" },

          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },

          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}