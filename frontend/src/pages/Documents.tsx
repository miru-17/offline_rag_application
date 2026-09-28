import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { useAuth } from "../auth/AuthContext";

import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDocument,
  type DocumentItem,
  type DocumentDetails,
} from "../api/documents.api";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
];

export default function Documents() {
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(
    null,
  );

  // ============================================================
  // ROLE PERMISSIONS
  // ============================================================

  const userRole = user?.role?.toUpperCase();

  const isViewer = userRole === "VIEWER";

  const canManageDocuments =
    userRole === "ADMIN" ||
    userRole === "USER";

  // ============================================================
  // DOCUMENT STATE
  // ============================================================

  const [documents, setDocuments] =
    useState<DocumentItem[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUploading, setIsUploading] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  // ============================================================
  // MESSAGE STATE
  // ============================================================

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ============================================================
  // DELETE STATE
  // ============================================================

  const [deleteDialogOpen, setDeleteDialogOpen] =
    useState(false);

  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentItem | null>(null);

  const [isDeleting, setIsDeleting] =
    useState(false);

  // ============================================================
  // DOCUMENT DETAILS STATE
  // ============================================================

  const [selectedDocument, setSelectedDocument] =
    useState<DocumentDetails | null>(null);

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState("");

  // ============================================================
  // LOAD DOCUMENTS
  // ============================================================

  const loadDocuments = async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await getDocuments();

      setDocuments(data);
    } catch (err) {
      console.error(
        "Failed to load documents:",
        err,
      );

      setError(
        "Unable to load documents. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  // ============================================================
  // FILE VALIDATION
  // ============================================================

  const validateFile = (
    file: File,
  ): string | null => {
    const fileName =
      file.name.toLowerCase();

    const hasValidExtension =
      ALLOWED_EXTENSIONS.some(
        (extension) =>
          fileName.endsWith(extension),
      );

    const hasValidMimeType =
      ALLOWED_FILE_TYPES.includes(
        file.type,
      );

    if (
      !hasValidExtension &&
      !hasValidMimeType
    ) {
      return "Only PDF, DOCX, and XLSX files are supported.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "File size must not exceed 25 MB.";
    }

    return null;
  };

  // ============================================================
  // FILE SELECTION
  // ============================================================

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError =
      validateFile(file);

    if (validationError) {
      setError(validationError);
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);
  };

  // ============================================================
  // UPLOAD DOCUMENT
  // ============================================================

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    if (!canManageDocuments) {
      setError(
        "You do not have permission to upload documents.",
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(25);
    setError("");
    setSuccess("");

    try {
      setUploadProgress(50);

      await uploadDocument(
        selectedFile,
      );

      setUploadProgress(100);

      setSuccess(
        `${selectedFile.name} uploaded successfully.`,
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadDocuments();
    } catch (err) {
      console.error(
        "Failed to upload document:",
        err,
      );

      setError(
        "Unable to upload document. Please try again.",
      );
    } finally {
      setIsUploading(false);

      setTimeout(() => {
        setUploadProgress(0);
      }, 500);
    }
  };

  // ============================================================
  // OPEN DELETE DIALOG
  // ============================================================

  const handleDeleteClick = (
    document: DocumentItem,
  ) => {
    if (!canManageDocuments) {
      return;
    }

    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
    setError("");
    setSuccess("");
  };

  // ============================================================
  // CLOSE DELETE DIALOG
  // ============================================================

  const handleCloseDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  // ============================================================
  // DELETE DOCUMENT
  // ============================================================

  const handleDelete = async () => {
    if (!documentToDelete) {
      return;
    }

    if (!canManageDocuments) {
      setError(
        "You do not have permission to delete documents.",
      );
      return;
    }

    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      await deleteDocument(
        documentToDelete.id,
      );

      setSuccess(
        `${documentToDelete.filename} deleted successfully.`,
      );

      setDeleteDialogOpen(false);
      setDocumentToDelete(null);

      await loadDocuments();
    } catch (err) {
      console.error(
        "Failed to delete document:",
        err,
      );

      setError(
        "Unable to delete document. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================
  // VIEW DOCUMENT DETAILS
  // ============================================================

  const handleViewDocument = async (
    documentId: string,
  ) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError("");
    setSelectedDocument(null);

    try {
      const document =
        await getDocument(documentId);

      setSelectedDocument(document);
    } catch (err) {
      console.error(
        "Failed to load document details:",
        err,
      );

      setDetailsError(
        "Unable to load document details. Please try again.",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // ============================================================
  // CLOSE DETAILS DIALOG
  // ============================================================

  const handleCloseDetails = () => {
    if (detailsLoading) {
      return;
    }

    setDetailsOpen(false);
    setSelectedDocument(null);
    setDetailsError("");
  };

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (
    value?: string,
  ) => {
    if (!value) {
      return "Date unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString();
  };

  // ============================================================
  // DOCUMENT STATUS
  // ============================================================

  const getDocumentStatusColor = (
    processed: boolean,
  ) => {
    return processed
      ? "success"
      : "warning";
  };

  const getDocumentStatusLabel = (
    processed: boolean,
  ) => {
    return processed
      ? "Ready"
      : "Processing";
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Stack spacing={3}>
      {/* ========================================================
          PAGE HEADER
      ======================================================== */}

      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 0.75,
            letterSpacing: "-0.02em",
          }}
        >
          Documents
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
        >
          Manage the knowledge sources available
          to your organization&apos;s AI workspace.
        </Typography>
      </Box>

      {/* ========================================================
          ALERTS
      ======================================================== */}

      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          onClose={() => setSuccess("")}
        >
          {success}
        </Alert>
      )}

      {/* ========================================================
          UPLOAD SECTION
          ADMIN + USER ONLY
      ======================================================== */}

      {canManageDocuments && (
        <Card
          sx={{
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  Add knowledge source
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Upload PDF, DOCX, or XLSX
                  documents for offline retrieval.
                </Typography>
              </Box>

              <Divider />

              <Box
                sx={{
                  border: "1.5px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 4,
                  textAlign: "center",
                  bgcolor: "action.hover",
                }}
              >
                <InsertDriveFileOutlinedIcon
                  sx={{
                    fontSize: 44,
                    color: "primary.main",
                    mb: 1,
                  }}
                />

                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {selectedFile
                    ? selectedFile.name
                    : "Select a document to upload"}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  PDF, DOCX, or XLSX · Maximum
                  25 MB
                </Typography>

                <Stack
                  direction={{
                    xs: "column",
                    sm: "row",
                  }}
                  spacing={1.5}
                  sx={{
                    mt: 2.5,
                    justifyContent: "center",
                  }}
                >
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={
                      <CloudUploadOutlinedIcon />
                    }
                    disabled={isUploading}
                  >
                    Choose file

                    <input
                      ref={fileInputRef}
                      hidden
                      type="file"
                      accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={
                        handleFileSelect
                      }
                    />
                  </Button>

                  <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={
                      !selectedFile ||
                      isUploading
                    }
                    startIcon={
                      isUploading ? (
                        <CircularProgress
                          size={18}
                          color="inherit"
                        />
                      ) : (
                        <CloudUploadOutlinedIcon />
                      )
                    }
                  >
                    {isUploading
                      ? "Uploading..."
                      : "Upload document"}
                  </Button>
                </Stack>
              </Box>

              {isUploading && (
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgress}
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "block",
                      mt: 0.75,
                    }}
                  >
                    Processing document...
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          VIEWER INFORMATION
      ======================================================== */}

      {isViewer && (
        <Alert
          severity="info"
          icon={
            <DescriptionOutlinedIcon />
          }
        >
          You have read-only access to the document
          library. You can view document details and
          use the AI workspace, but you cannot upload
          or delete documents.
        </Alert>
      )}

      {/* ========================================================
          DOCUMENT LIBRARY
      ======================================================== */}

      <Card
        sx={{
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            {/* HEADER */}

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  Document library
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {documents.length}{" "}
                  {documents.length === 1
                    ? "document"
                    : "documents"}{" "}
                  available in your tenant.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={
                  <RefreshOutlinedIcon />
                }
                onClick={() =>
                  void loadDocuments()
                }
                disabled={isLoading}
              >
                Refresh
              </Button>
            </Box>

            <Divider />

            {/* LOADING */}

            {isLoading ? (
              <Box
                sx={{
                  py: 6,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <CircularProgress />
              </Box>
            ) : documents.length === 0 ? (
              /* EMPTY STATE */

              <Box
                sx={{
                  py: 7,
                  textAlign: "center",
                }}
              >
                <DescriptionOutlinedIcon
                  sx={{
                    fontSize: 52,
                    color: "text.disabled",
                    mb: 1.5,
                  }}
                />

                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  No documents yet
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 0.75,
                    maxWidth: 520,
                    mx: "auto",
                  }}
                >
                  {canManageDocuments
                    ? "Upload your first PDF, DOCX, or XLSX document to start building your knowledge base."
                    : "There are currently no documents available in your tenant."}
                </Typography>

                {canManageDocuments && (
                  <Button
                    variant="contained"
                    startIcon={
                      <CloudUploadOutlinedIcon />
                    }
                    component="label"
                    sx={{ mt: 2.5 }}
                  >
                    Upload document

                    <input
                      hidden
                      type="file"
                      accept=".pdf,.docx,.xlsx"
                      onChange={
                        handleFileSelect
                      }
                    />
                  </Button>
                )}
              </Box>
            ) : (
              /* DOCUMENT TABLE */

              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflowX: "auto",
                }}
              >
                <Table
                  sx={{
                    minWidth: 720,
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Document
                      </TableCell>

                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Type
                      </TableCell>

                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Status
                      </TableCell>

                      <TableCell
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Uploaded
                      </TableCell>

                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                        }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {documents.map(
                      (document) => (
                        <TableRow
                          key={document.id}
                          hover
                        >
                          {/* DOCUMENT */}

                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems:
                                  "center",
                                gap: 1.5,
                                minWidth: 220,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 1.5,
                                  bgcolor:
                                    "action.hover",
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  color:
                                    "primary.main",
                                  flexShrink: 0,
                                }}
                              >
                                <DescriptionOutlinedIcon />
                              </Box>

                              <Box
                                sx={{
                                  minWidth: 0,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    overflow:
                                      "hidden",
                                    textOverflow:
                                      "ellipsis",
                                    whiteSpace:
                                      "nowrap",
                                    maxWidth: {
                                      xs: 220,
                                      sm: 360,
                                    },
                                  }}
                                >
                                  {
                                    document.filename
                                  }
                                </Typography>

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Document
                                  source
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* FILE TYPE */}

                          <TableCell>
                            <Chip
                              label={
                                document.file_type
                                  ?.toUpperCase() ||
                                "FILE"
                              }
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>

                          {/* STATUS */}

                          <TableCell>
                            <Chip
                              label={getDocumentStatusLabel(
                                document.processed,
                              )}
                              color={getDocumentStatusColor(
                                document.processed,
                              )}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>

                          {/* CREATED DATE */}

                          <TableCell>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {formatDate(
                                document.created_at,
                              )}
                            </Typography>
                          </TableCell>

                          {/* ACTIONS */}

                          <TableCell align="right">
                            <Stack
                              component="div"
                              direction="row"
                              spacing={0.5}
                              sx={{ justifyContent: "flex-end" }}
                            >
                              {/* VIEW */}

                              <Tooltip title="View details">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    void handleViewDocument(
                                      document.id,
                                    )
                                  }
                                >
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              {/* DELETE */}

                              {canManageDocuments && (
                                <Tooltip title="Delete document">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() =>
                                      handleDeleteClick(
                                        document,
                                      )
                                    }
                                  >
                                    <DeleteOutlineOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ========================================================
          DELETE CONFIRMATION DIALOG
      ======================================================== */}

      <Dialog
        open={deleteDialogOpen}
        onClose={
          handleCloseDeleteDialog
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
          }}
        >
          Delete document?
        </DialogTitle>

        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete{" "}
            <strong>
              {documentToDelete?.filename}
            </strong>
            ? This action cannot be undone.
          </DialogContentText>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
          }}
        >
          <Button
            onClick={
              handleCloseDeleteDialog
            }
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={() =>
              void handleDelete()
            }
            disabled={isDeleting}
            startIcon={
              isDeleting ? (
                <CircularProgress
                  size={18}
                  color="inherit"
                />
              ) : (
                <DeleteOutlineOutlinedIcon />
              )
            }
          >
            {isDeleting
              ? "Deleting..."
              : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================
          DOCUMENT DETAILS DIALOG
      ======================================================== */}

      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
          }}
        >
          Document details
        </DialogTitle>

        <DialogContent>
          {detailsLoading ? (
            <Box
              sx={{
                py: 6,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : detailsError ? (
            <Alert severity="error">
              {detailsError}
            </Alert>
          ) : selectedDocument ? (
            <Stack spacing={2.5}>
              {/* FILE NAME */}

              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Filename
                </Typography>

                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                    mt: 0.25,
                    wordBreak: "break-word",
                  }}
                >
                  {
                    selectedDocument.filename
                  }
                </Typography>
              </Box>

              <Divider />

              {/* FILE TYPE */}

              <Box
                sx={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  File type
                </Typography>

                <Chip
                  label={
                    selectedDocument.file_type?.toUpperCase() ||
                    "FILE"
                  }
                  size="small"
                  variant="outlined"
                />
              </Box>

              {/* PROCESSED */}

              <Box
                sx={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Processing status
                </Typography>

                <Chip
                  label={
                    selectedDocument.processed
                      ? "Ready"
                      : "Processing"
                  }
                  color={
                    selectedDocument.processed
                      ? "success"
                      : "warning"
                  }
                  size="small"
                  variant="outlined"
                />
              </Box>

              {/* UPLOADED */}

              <Box
                sx={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "flex-start",
                  gap: 2,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Uploaded
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    textAlign: "right",
                  }}
                >
                  {formatDate(
                    selectedDocument.created_at,
                  )}
                </Typography>
              </Box>

              <Divider />

              {/* DOCUMENT ID */}

              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Document ID
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    fontFamily:
                      "monospace",
                    wordBreak:
                      "break-all",
                    mt: 0.5,
                  }}
                >
                  {selectedDocument.id}
                </Typography>
              </Box>

              {/* TENANT ID */}

              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Tenant ID
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    fontFamily:
                      "monospace",
                    wordBreak:
                      "break-all",
                    mt: 0.5,
                  }}
                >
                  {
                    selectedDocument.tenant_id
                  }
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Typography
              color="text.secondary"
            >
              No document details available.
            </Typography>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2.5,
          }}
        >
          <Button
            onClick={
              handleCloseDetails
            }
            disabled={detailsLoading}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}