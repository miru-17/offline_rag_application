import type { ReactNode } from "react";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import DifferenceOutlinedIcon from "@mui/icons-material/DifferenceOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";

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
    label: "Data Dashboard",
    path: "/data",
    icon: <InsightsOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "Charts and answers from CSV / Excel tables",
    section: "workspace",
  },
  {
    label: "Extraction",
    path: "/extraction",
    icon: <TableChartOutlinedIcon />,
    roles: ["ADMIN", "USER"],
    description: "Pull fields from many documents into one table",
    section: "workspace",
  },
  {
    label: "Compare",
    path: "/compare",
    icon: <DifferenceOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "What changed between two document versions",
    section: "workspace",
  },
  {
    label: "Team spaces",
    path: "/teams",
    icon: <GroupsOutlinedIcon />,
    roles: ["ADMIN", "USER", "VIEWER"],
    description: "Documents shared with a team such as HR or Finance",
    section: "workspace",
  },
  {
    label: "Insights",
    path: "/insights",
    icon: <QueryStatsOutlinedIcon />,
    roles: ["ADMIN"],
    description: "Usage, answer quality, knowledge gaps and system health",
    section: "admin",
  },
  {
    label: "Audit log",
    path: "/audit",
    icon: <FactCheckOutlinedIcon />,
    roles: ["ADMIN"],
    description: "Who did what, and when",
    section: "admin",
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
    description: "Signed licence status, expiry and installation",
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
