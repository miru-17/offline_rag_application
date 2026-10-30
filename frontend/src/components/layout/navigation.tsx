import type { ReactNode } from "react";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";

export type Role = "ADMIN" | "USER" | "VIEWER";

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: Role[];
  description: string;
  section: "workspace" | "admin" | "system";
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <SpaceDashboardOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "Knowledge base and platform overview",
    section: "workspace",
  },
  {
    label: "AI Workspace",
    path: "/ai-workspace",
    icon: <ForumOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "Ask questions answered from your documents",
    section: "workspace",
  },
  {
    label: "Documents",
    path: "/documents",
    icon: <FolderOpenOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "Upload and manage the knowledge library",
    section: "workspace",
  },
  {
    label: "Users & roles",
    path: "/users",
    icon: <GroupOutlinedIcon />,
    roles: ["ADMIN"],
    description: "Manage tenant members and permissions",
    section: "admin",
  },
  {
    label: "License",
    path: "/license",
    icon: <WorkspacePremiumOutlinedIcon />,
    roles: ["ADMIN"],
    description: "License status and expiry",
    section: "admin",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: <TuneOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "Account, retrieval and appearance",
    section: "system",
  },
];

export const navItemsForRole = (role?: string): NavItem[] => {
  const upper = role?.toUpperCase() as Role | undefined;
  return upper ? NAV_ITEMS.filter((item) => item.roles.includes(upper)) : [];
};

export const findNavItem = (pathname: string): NavItem | undefined =>
  NAV_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
