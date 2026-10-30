import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../api/documents.api";
import { addGroupMember, createGroup, deleteGroup, getGroups, removeGroupMember, type TeamSpace } from "../api/groups.api";
import { getUsers, type ManagedUser } from "../api/users.api";
import PageHeader from "../components/rag/PageHeader";

export default function TeamSpaces() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [groups, setGroups] = useState<TeamSpace[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Record<string, ManagedUser | null>>({});

  const load = useCallback(async () => {
    try {
      setGroups(await getGroups());
    } catch (err) {
      setError(errorMessage(err, "Unable to load team spaces."));
    }
  }, []);

  useEffect(() => {
    void load();
    if (isAdmin) getUsers().then(setUsers).catch(() => setUsers([]));
  }, [load, isAdmin]);

  const replace = (updated: TeamSpace) =>
    setGroups((current) => current.map((g) => (g.id === updated.id ? { ...updated, document_count: g.document_count } : g)));

  const act = async (fn: () => Promise<unknown>, fallback: string) => {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Team Spaces"
        subtitle={isAdmin
          ? "Create spaces like HR or Finance. Documents uploaded to a space are answered only for its members."
          : "The team spaces you belong to. Their documents are included in your answers."}
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      {isAdmin && (
        <Card sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>New team space</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)}
                         slotProps={{ htmlInput: { maxLength: 100 } }} />
              <TextField size="small" label="Description (optional)" value={description} sx={{ flex: 1 }}
                         onChange={(e) => setDescription(e.target.value)} slotProps={{ htmlInput: { maxLength: 255 } }} />
              <Button variant="contained" startIcon={<AddRoundedIcon />} disabled={name.trim().length < 2}
                      onClick={() => void act(async () => {
                        await createGroup(name.trim(), description.trim() || undefined);
                        setName(""); setDescription("");
                        await load();
                      }, "Unable to create the team space.")}>
                Create
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            <GroupsOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {isAdmin ? "No team spaces yet." : "You are not a member of any team space."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {groups.map((group) => {
            const candidates = users.filter((u) => !group.members.some((m) => m.id === u.id));
            return (
              <Card key={group.id} sx={{ border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{group.name}</Typography>
                      {group.description && <Typography variant="body2" color="text.secondary">{group.description}</Typography>}
                      <Typography variant="caption" color="text.secondary">
                        {group.members.length} member{group.members.length === 1 ? "" : "s"} · {group.document_count} document{group.document_count === 1 ? "" : "s"}
                      </Typography>
                    </Box>
                    {isAdmin && (
                      <Tooltip title={group.document_count ? "Remove its documents first" : "Delete team space"}>
                        <span>
                          <IconButton color="error" size="small" disabled={group.document_count > 0}
                                      onClick={() => void act(async () => { await deleteGroup(group.id); await load(); },
                                        "Unable to delete the team space.")}>
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Box>

                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 2 }}>
                    {group.members.map((m) => (
                      <Chip key={m.id} label={m.username}
                            onDelete={isAdmin ? () => void act(async () => replace(await removeGroupMember(group.id, m.id)),
                              "Unable to remove the member.") : undefined} />
                    ))}
                    {group.members.length === 0 && <Typography variant="body2" color="text.secondary">No members yet.</Typography>}
                  </Stack>

                  {isAdmin && (
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Autocomplete
                        size="small"
                        sx={{ flex: 1 }}
                        options={candidates}
                        value={picked[group.id] ?? null}
                        onChange={(_, v) => setPicked((p) => ({ ...p, [group.id]: v }))}
                        getOptionLabel={(u) => `${u.username} (${u.role})`}
                        renderInput={(params) => <TextField {...params} label="Add member" />}
                      />
                      <Button variant="outlined" disabled={!picked[group.id]}
                              onClick={() => void act(async () => {
                                replace(await addGroupMember(group.id, picked[group.id]!.id));
                                setPicked((p) => ({ ...p, [group.id]: null }));
                              }, "Unable to add the member.")}>
                        Add
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
