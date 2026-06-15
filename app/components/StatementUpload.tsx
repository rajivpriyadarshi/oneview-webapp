"use client";

import { ChangeEvent, CSSProperties, DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand } from "./BrandMarks";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import { OneviewInfoModal } from "./OneviewInfoModal";
import { PasswordPromptModal } from "./PasswordPromptModal";
import {
  api,
  useUploadBrokerStatementMutation,
  useRetryWithPasswordMutation,
  useLazyGetBrokerStatementJobStatusQuery,
  useListPortfoliosQuery,
  useGetProfileQuery,
  useDeleteDocumentMutation,
} from "../store/api";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addTrayItems, patchTrayItem, removeTrayItem, dismissTray } from "../store/uploadTraySlice";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";
import { pollBrokerStatementJobStatus } from "../lib/documentsApi";
import { getRequestErrorMessage } from "../lib/apiClient";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

const CHART_COLORS = [
  "#7F4E0B", "#CE8016", "#A29076", "#444341", "#CAC0B2",
  "#59886B", "#B5603A", "#7D8840", "#A87C70", "#486878",
  "#508040", "#7A8898", "#C8A020", "#6B4060", "#4868A0",
  "#4A7050", "#508878", "#8878A0", "#785090", "#384870",
  "#8A5A48", "#904868", "#A0888C", "#6A7858",
];

type UploadStatus = "queued" | "uploading" | "complete" | "error" | "review" | "password";

type UploadItem = {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  detail?: string;
  error?: string;
  documentId?: string;
};

export function StatementUpload() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollingAbortControllerRef = useRef<AbortController | null>(null);
  const uploadQueueRef = useRef<{ item: UploadItem; file: File }[]>([]);
  const filesRef = useRef<Map<string, File>>(new Map());
  const isProcessingQueueRef = useRef(false);
  const [firstName, setFirstName] = useState("there");
  const uploadItems = useAppSelector((s) => s.uploadTray.items);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [hasStartedUploadFlow, setHasStartedUploadFlow] = useState(false);

  const hasCompletedUploads = uploadItems.some((item) => item.status === "complete" || item.status === "review");

  const { data: profile, isError: profileError } = useGetProfileQuery(undefined, {
    skip: !getStoredAuthToken(),
  });
  const { data: portfolios } = useListPortfoliosQuery(undefined, {
    skip: !profile,
  });

  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();
  const [retryWithPassword] = useRetryWithPasswordMutation();
  const [getBrokerStatementJobStatus] = useLazyGetBrokerStatementJobStatusQuery();
  const [deleteDocument] = useDeleteDocumentMutation();
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isRetryingPassword, setIsRetryingPassword] = useState(false);
  const [pendingPasswordDocId, setPendingPasswordDocId] = useState<string | number | null>(null);
  const [pendingPasswordItemId, setPendingPasswordItemId] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      router.replace("/");
      return;
    }

    if (profileError) {
      clearAuthToken();
      router.replace("/");
      return;
    }

    if (!profile) return;

    const emailPrefix = profile.email.split("@")[0];
    const displayName = profile.display_name?.trim();

    if (!displayName || displayName === emailPrefix) {
      router.replace("/profile/setup");
      return;
    }

    if (!hasStartedUploadFlow && portfolios && portfolios.length > 0) {
      router.replace("/dashboard");
      return;
    }

    setFirstName(displayName.split(/\s+/)[0]);
  }, [router, profile, profileError, portfolios, hasStartedUploadFlow]);

  useEffect(() => {
    trackPage({
      pageName: trackingEventsMap.documentsPage.PAGE,
      params: {
        page_url: window.location.href,
        page_title: document.title,
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      pollingAbortControllerRef.current?.abort();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      void handleUploadFiles(files);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      void handleUploadFiles(files);
    }
  }

  function validateFile(file: File): string {
    const lowerName = file.name.toLowerCase();
    const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );
    if (!hasSupportedExtension) {
      return "Only CSV, XLSX, or PDF files are supported.";
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return "File size must be 10 MB or less.";
    }
    return "";
  }

  async function handleUploadFiles(files: File[]) {
    setError("");
    setMessage("");
    setHasStartedUploadFlow(true);

    const preparedItems: (UploadItem & { file: File })[] = files.map((file, index) => {
      const validationError = validateFile(file);

      trackClick({
        buttonName: trackingEventsMap.documentsPage.CLICK_UPLOAD_STATEMENT,
        pageName: trackingEventsMap.documentsPage.PAGE,
        params: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        },
      });

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        name: file.name,
        size: file.size,
        status: (validationError ? "error" : "queued") as UploadStatus,
        progress: 0,
        error: validationError || undefined,
      };
    });

    for (const item of preparedItems) {
      filesRef.current.set(item.id, item.file);
    }

    const trayItems = preparedItems.map(({ file: _file, ...rest }) => rest);
    dispatch(addTrayItems(trayItems));

    const validUploads = preparedItems.filter(item => item.status !== "error");

    if (validUploads.length === 0) {
      setError("No supported files selected.");
      return;
    }

    uploadQueueRef.current.push(...validUploads.map(({ file, ...item }) => ({ item, file })));

    if (isProcessingQueueRef.current) return;

    isProcessingQueueRef.current = true;
    setIsUploading(true);

    try {
      let successCount = 0;

      while (uploadQueueRef.current.length > 0) {
        const entry = uploadQueueRef.current.shift()!;
        const { item, file } = entry;
        dispatch(patchTrayItem({ id: item.id, status: "uploading", progress: 0 }));
        startProgressAnimation(item.id);

        try {
          const response = await uploadBrokerStatement({
            file,
            name: file.name,
            storeData: true,
            portfolioName: "Main Portfolio",
            useLlmFallback: true,
          }).unwrap();

          if (response.status === "duplicate") {
            const uploadDate = new Date(response.uploaded_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            trackAPI({
              pageName: trackingEventsMap.documentsPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                error: "duplicate",
                file_name: file.name,
                existing_document_id: response.existing_document_id,
              },
            });
            dispatch(patchTrayItem({
              id: item.id,
              status: "error",
              progress: 0,
              error: `This file was already uploaded on ${uploadDate}.`,
            }));
          } else if (response.status === "error") {
            if (response.error_code === "password_required" || response.error_code === "password_incorrect") {
              setPendingPasswordDocId(response.document_id ?? null);
              setPendingPasswordItemId(item.id);
              setPasswordError(response.error_code === "password_incorrect" ? (response.error ?? "The provided password is incorrect.") : "");
              setShowPasswordPrompt(true);
              dispatch(patchTrayItem({
                id: item.id,
                status: "password",
                progress: 0,
                error: "Password required",
                documentId: response.document_id ? String(response.document_id) : undefined,
              }));
            } else {
              trackAPI({
                pageName: trackingEventsMap.documentsPage.PAGE,
                params: {
                  event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                  file_name: file.name,
                  error: response.error,
                },
              });
              dispatch(patchTrayItem({
                id: item.id,
                status: "error",
                progress: 0,
                error: response.error ?? "Unable to parse this statement.",
              }));
            }
          } else if (response.status === "processing") {
            dispatch(patchTrayItem({
              id: item.id,
              status: "uploading",
              progress: 90,
              detail: response.message ?? "Extracting statement details.",
            }));

            const abortController = new AbortController();
            pollingAbortControllerRef.current = abortController;

            try {
              const jobResult = await pollBrokerStatementJobStatus({
                jobId: response.job_id,
                signal: abortController.signal,
                getStatus: (jobId) => getBrokerStatementJobStatus(jobId, false).unwrap(),
                onProgress: (progress) => {
                  const label = progress?.label?.replace(/^OCR/i, "Scanning") ?? "Extracting statement details.";
                  if (
                    typeof progress?.current === "number" &&
                    typeof progress.total === "number" &&
                    progress.total > 0
                  ) {
                    const pct = Math.min(
                      95,
                      Math.max(10, Math.round((progress.current / progress.total) * 95)),
                    );
                    dispatch(patchTrayItem({
                      id: item.id,
                      progress: pct,
                      detail: label,
                    }));
                    return;
                  }
                  dispatch(patchTrayItem({
                    id: item.id,
                    detail: label,
                  }));
                },
              });

              if (jobResult.status === "error") {
                trackAPI({
                  pageName: trackingEventsMap.documentsPage.PAGE,
                  params: {
                    event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                    error: jobResult.error,
                    file_name: file.name,
                    job_id: response.job_id,
                  },
                });
                dispatch(patchTrayItem({
                  id: item.id,
                  status: "error",
                  progress: 0,
                  detail: undefined,
                  error: jobResult.error ?? "Unable to process this statement.",
                }));
              } else if (jobResult.status === "needs_review") {
                trackAPI({
                  pageName: trackingEventsMap.documentsPage.PAGE,
                  params: {
                    event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                    error: jobResult.message,
                    file_name: file.name,
                    job_id: response.job_id,
                    status: "needs_review",
                  },
                });
                dispatch(patchTrayItem({
                  id: item.id,
                  status: "review",
                  progress: 0,
                  detail: undefined,
                  error: "Needs manual review to extract information",
                }));
              } else {
                successCount += 1;
                dispatch(
                  api.util.invalidateTags([
                    "Documents",
                    "Portfolios",
                    "PortfolioView",
                    "Sankey",
                  ]),
                );
                trackAPI({
                  pageName: trackingEventsMap.documentsPage.PAGE,
                  params: {
                    event_name: trackingEventsMap.documentsPage.API_UPLOAD_SUCCESS,
                    document_id: jobResult.document_id,
                    positions_count: jobResult.positions_count,
                    file_name: file.name,
                    job_id: response.job_id,
                  },
                });
                if (jobResult.storage?.overwrote_existing) {
                  setMessage(
                    `Updated ${jobResult.storage.positions_updated} existing positions for this statement date.`,
                  );
                }
                dispatch(patchTrayItem({
                  id: item.id,
                  status: "complete",
                  progress: 100,
                  detail: getUploadCompleteDetail(jobResult.positions_count, item.size),
                  documentId: String(jobResult.document_id),
                }));
              }
            } finally {
              pollingAbortControllerRef.current = null;
            }
          } else {
            successCount += 1;
            trackAPI({
              pageName: trackingEventsMap.documentsPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsPage.API_UPLOAD_SUCCESS,
                file_name: file.name,
                document_id: response.document_id,
                positions_count: response.positions_count,
              },
            });
            dispatch(patchTrayItem({
              id: item.id,
              status: "complete",
              progress: 100,
              detail: getUploadCompleteDetail(response.positions_count, item.size),
              documentId: String(response.document_id),
            }));
          }
        } catch (uploadError) {
          // Handle password-protected PDF errors (400 responses from RTK Query)
          const errorData = typeof uploadError === "object" && uploadError !== null && "data" in uploadError
            ? (uploadError as { data: unknown }).data
            : null;

          if (
            errorData &&
            typeof errorData === "object" &&
            "error_code" in errorData &&
            ((errorData as { error_code: string }).error_code === "password_required" ||
              (errorData as { error_code: string }).error_code === "password_incorrect")
          ) {
            const data = errorData as { document_id: string | number; error?: string; error_code: string };
            setPendingPasswordDocId(data.document_id);
            setPendingPasswordItemId(item.id);
            setPasswordError(data.error_code === "password_incorrect" ? (data.error ?? "The provided password is incorrect.") : "");
            setShowPasswordPrompt(true);
            dispatch(patchTrayItem({ id: item.id, status: "password", progress: 0, error: "Password required", documentId: String(data.document_id) }));
          } else {
            trackAPI({
              pageName: trackingEventsMap.documentsPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                file_name: file.name,
                error: getRequestErrorMessage(uploadError, "Upload failed"),
              },
            });
            dispatch(patchTrayItem({
              id: item.id,
              status: "error",
              progress: 0,
              detail: undefined,
              error: getRequestErrorMessage(uploadError, "Upload failed."),
            }));
          }
        }
      }

      if (successCount > 0) {
        setMessage(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""} successfully.`);
        setTimeout(() => setMessage(""), 3000);
      }
    } finally {
      isProcessingQueueRef.current = false;
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function startProgressAnimation(itemId: string) {
    const interval = setInterval(() => {
      dispatch((dispatchFn, getState) => {
        const item = (getState() as { uploadTray: { items: UploadItem[] } }).uploadTray.items.find(
          (i) => i.id === itemId,
        );
        if (item && item.status === "uploading" && item.progress < 90) {
          dispatchFn(patchTrayItem({ id: itemId, progress: Math.min(item.progress + 5, 90) }));
        }
      });
    }, 200);
    setTimeout(() => clearInterval(interval), 20000);
  }

  async function removeUploadItem(itemId: string) {
    const item = uploadItems.find(i => i.id === itemId);
    if (!item) return;

    trackClick({
      buttonName: trackingEventsMap.documentsPage.CLICK_REMOVE_DOCUMENT,
      pageName: trackingEventsMap.documentsPage.PAGE,
      params: {
        document_id: item.documentId,
        file_name: item.name,
      },
    });

    if (item.status === "uploading") {
      pollingAbortControllerRef.current?.abort();
    }

    if (item.documentId && item.status === "complete") {
      try {
        await deleteDocument(item.documentId).unwrap();
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_DELETE_SUCCESS,
            document_id: item.documentId,
          },
        });
      } catch (err) {
        console.error("Failed to delete document:", err);
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_DELETE_FAILURE,
            document_id: item.documentId,
            error: err instanceof Error ? err.message : "Delete failed",
          },
        });
      }
    }

    filesRef.current.delete(itemId);
    dispatch(removeTrayItem(itemId));
  }

  async function handlePasswordSubmit(password: string) {
    if (!pendingPasswordDocId) return;

    setIsRetryingPassword(true);
    setPasswordError("");

    try {
      const response = await retryWithPassword({
        documentId: pendingPasswordDocId,
        password,
      }).unwrap();

      if (response.status === "error") {
        if (response.error_code === "password_incorrect") {
          setPasswordError(response.error ?? "The provided password is incorrect.");
          return;
        }
        setShowPasswordPrompt(false);
        setError(response.error ?? "Unable to parse this statement.");
        return;
      }

      setShowPasswordPrompt(false);
      setPendingPasswordDocId(null);
      setPasswordError("");
      setMessage("File unlocked and processed successfully.");
      if (pendingPasswordItemId) {
        const posCount = "positions_count" in response ? response.positions_count : undefined;
        const docId = "document_id" in response ? String(response.document_id) : undefined;
        dispatch(patchTrayItem({
          id: pendingPasswordItemId,
          status: "complete",
          progress: 100,
          error: undefined,
          detail: typeof posCount === "number"
            ? `${posCount} holding${posCount === 1 ? "" : "s"}`
            : undefined,
          documentId: docId,
        }));
        setPendingPasswordItemId(null);
      }
      dispatch(
        api.util.invalidateTags(["Documents", "Portfolios", "PortfolioView", "Sankey"]),
      );
    } catch (err) {
      const errorData = typeof err === "object" && err !== null && "data" in err
        ? (err as { data: unknown }).data
        : null;

      if (
        errorData &&
        typeof errorData === "object" &&
        "error_code" in errorData &&
        (errorData as { error_code: string }).error_code === "password_incorrect"
      ) {
        setPasswordError((errorData as { error?: string }).error ?? "The provided password is incorrect.");
      } else {
        setPasswordError(
          err instanceof Error ? err.message : "Failed to unlock document.",
        );
      }
    } finally {
      setIsRetryingPassword(false);
    }
  }

  function handlePasswordPromptClose() {
    setShowPasswordPrompt(false);
    setPendingPasswordDocId(null);
    setPendingPasswordItemId(null);
    setPasswordError("");
  }

  function handleRetryPassword(itemId: string, documentId: string) {
    setPendingPasswordDocId(documentId);
    setPendingPasswordItemId(itemId);
    setPasswordError("");
    setShowPasswordPrompt(true);
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || "U";
  };

  const getColorFromName = (name: string) => {
    const asciiSum = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return CHART_COLORS[asciiSum % CHART_COLORS.length];
  };

  const displayName = profile?.display_name || "";
  const initials = displayName ? getInitials(displayName) : "U";
  const avatarColor = displayName ? getColorFromName(displayName) : CHART_COLORS[0];

  return (
    <>
    <main
      className="relative flex flex-col overflow-y-auto lg:overflow-hidden"
      style={{ minHeight: "100vh", height: "100vh", background: "url('/auth-Hero-bg.png') center/cover no-repeat fixed" }}
    >
      {/* Topbar */}
      <header
        className="statement-topbar fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-[67px] py-[18px] max-[768px]:px-4 max-[768px]:py-3"
        style={{ background: "rgba(246,243,238,0.85)", backdropFilter: "blur(10px)" }}
      >
        <OneviewBrand />
        <div className="relative z-[100]">
          <button
            className="border-0 bg-transparent p-0 cursor-pointer"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="Profile menu"
          >
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="22" fill={avatarColor} />
              <text
                x="22"
                y="22"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fill: "#FFF",
                  fontFamily: "Inter",
                  fontSize: "16px",
                  fontWeight: 600,
                  letterSpacing: "-0.64px",
                }}
              >
                {initials}
              </text>
            </svg>
          </button>
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute top-[calc(100%+8px)] right-0 z-[1000] min-w-[140px] rounded-xl border border-black/[0.08] bg-white p-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <button
                  className="flex w-full items-center gap-[10px] rounded-lg border-none bg-transparent px-[14px] py-3 font-satoshi text-sm font-medium text-[var(--foreground)] cursor-pointer transition-colors hover:bg-black/[0.05]"
                  style={{ fontFeatureSettings: "'ss03' on" }}
                  onClick={() => {
                    dispatch(dismissTray());
                    clearAuthToken();
                    router.push("/");
                  }}
                >
                  <LogoutIcon />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <section
        className="relative z-[1] flex flex-1 flex-col items-center w-full px-5 py-2 mt-20 max-[1024px]:mt-[124px] max-[768px]:mt-[112px] max-[768px]:px-[14px] max-[768px]:pb-6 lg:px-[80px] overflow-hidden"
        aria-labelledby="statement-title"
      >
        {/* Two-column grid */}
        <div className="flex w-full max-w-[1400px] flex-col gap-8 lg:grid lg:gap-[80px] lg:[grid-template-columns:1fr_1fr]">

          {/* Left Column — desktop sticky */}
          <div className="hidden lg:flex lg:sticky lg:top-[80px] lg:flex-col lg:justify-center lg:pb-10" style={{ height: "calc(100vh - 80px)" }}>
            <div className="flex flex-col gap-2">
              <p className="m-0 font-normal leading-[120%] tracking-[-0.02em] text-black text-[20px]" style={{ fontFamily: "var(--font-butler-roman-display), ButlerPro, Georgia, 'Times New Roman', serif" }}>
                Welcome {firstName}!
              </p>
              <h1
                id="statement-title"
                className="m-0 mb-[16px] text-left font-normal leading-[120%] tracking-[-0.03em] text-black text-[48px]"
                style={{ fontFamily: "var(--font-butler-roman-display), ButlerPro, Georgia, 'Times New Roman', serif" }}
              >
                Add your account statements
                <br />
                to create your unified view
              </h1>
            </div>

            <div className="flex items-center gap-3 flex-nowrap">
              <div className="flex items-center">
                <img src="/broker-icons/groww.png" alt="Groww" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]" />
                <img src="/broker-icons/fidelity.png" alt="Fidelity" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/zerodha.png" alt="Zerodha" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/vested.png" alt="Vested" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/shwab.png" alt="Charles Schwab" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/ibkr.png" alt="IBKR" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_DOWNLOAD_INSTRUCTIONS,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  setIsModalOpen(true);
                }}
                className="border-0 bg-transparent p-0 text-[#7F4E0B] font-satoshi text-[16px] font-medium leading-[150%] tracking-[-0.56px] underline cursor-pointer transition-opacity hover:opacity-80 whitespace-nowrap"
                style={{ fontFeatureSettings: "'ss03' on" }}
              >
                See download instruction
              </button>
            </div>

            <div className="mt-10 flex flex-col items-start gap-3 w-full">
              <button
                className="min-h-[64px] rounded-[38px] bg-black/[0.04] px-[32px] font-satoshi text-[16px] font-bold leading-6 tracking-[-0.02em] text-[#1a1a1a] border-none cursor-pointer transition-all hover:bg-black/10 hover:-translate-y-px whitespace-nowrap"
                style={{ fontFeatureSettings: "'ss03' on" }}
                type="button"
                onClick={() => {
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_CHECK_SAMPLE,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  setIsSampleModalOpen(true);
                }}
              >
                Check sample
              </button>
            </div>
          </div>

          {/* Left Column — mobile */}
          <div className="lg:hidden flex flex-col items-center text-center gap-2 w-full">
            <p className="m-0 font-normal leading-[120%] tracking-[-0.02em] text-black text-[20px]" style={{ fontFamily: "var(--font-butler-roman-display), ButlerPro, Georgia, 'Times New Roman', serif" }}>
              Welcome {firstName}!
            </p>
            <h1
              className="m-0 text-center font-normal leading-[1.15] tracking-[-0.5px] text-black text-[2.125rem]"
              style={{ fontFamily: "var(--font-butler-roman), ButlerPro, Georgia, 'Times New Roman', serif" }}
            >
              Add your account statements
              <br />
              to create your unified view
            </h1>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center">
                <img src="/broker-icons/groww.png" alt="Groww" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]" />
                <img src="/broker-icons/fidelity.png" alt="Fidelity" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/zerodha.png" alt="Zerodha" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/vested.png" alt="Vested" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/shwab.png" alt="Charles Schwab" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
                <img src="/broker-icons/ibkr.png" alt="IBKR" className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] -ml-2" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_DOWNLOAD_INSTRUCTIONS,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  setIsModalOpen(true);
                }}
                className="border-0 bg-transparent p-0 text-[#7F4E0B] font-satoshi text-[16px] font-medium leading-[150%] tracking-[-0.56px] underline cursor-pointer transition-opacity hover:opacity-80"
                style={{ fontFeatureSettings: "'ss03' on" }}
              >
                See download instruction
              </button>
            </div>

            <div className="mt-3 w-full">
              <button
                className="w-full min-h-[54px] rounded-[38px] bg-black/[0.04] px-[18px] py-[14px] font-satoshi text-base font-bold leading-6 tracking-[-0.02em] text-[#1a1a1a] border-none cursor-pointer transition-all hover:bg-black/10 hover:-translate-y-px"
                style={{ fontFeatureSettings: "'ss03' on" }}
                type="button"
                onClick={() => {
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_CHECK_SAMPLE,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  setIsSampleModalOpen(true);
                }}
              >
                Check sample
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-4 w-full lg:overflow-y-auto lg:max-h-[calc(100vh-120px)] lg:pt-[20px] lg:pb-[20px] lg:justify-center">

            {/* Security badge */}
            <p
              className="flex items-center justify-center self-center gap-2 m-0 font-satoshi text-[16px] font-medium leading-[150%] tracking-[-0.28px] text-black/70"
              style={{ fontFeatureSettings: "'ss03' on" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1.33334L2.66667 3.33334V7.33334C2.66667 10.6667 5.33333 13.6667 8 14.6667C10.6667 13.6667 13.3333 10.6667 13.3333 7.33334V3.33334L8 1.33334Z" stroke="#4CAF50" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 8L7.33333 9.33333L10 6.66667" stroke="#4CAF50" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Your data stays encrypted • 100% Safe and Secure
            </p>

            {/* Dropzone */}
            <label
              className={`statement-dropzone${isDragging ? " is-dragging" : ""} w-full`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg className="statement-dropzone-border" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <rect x="1" y="1" rx="31" ry="31" fill="none" stroke="rgba(127,78,11,0.3)" strokeWidth="2" strokeDasharray="14 8" style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }} />
              </svg>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.pdf"
                multiple
                onChange={handleFileChange}
                disabled={false}
              />
              <span className="upload-icon">
                <UploadIcon />
              </span>
              <strong>Drop your statements here or <span className="select-files-text">select files</span></strong>
              <span className="font-satoshi text-[14px] font-normal leading-[150%] tracking-[-0.02em] text-center" style={{ fontFeatureSettings: "'ss03' on" }}>CSV, XLSX, PDF (Max 10MB)</span>
            </label>

            {/* File list */}
            {uploadItems.length > 0 && (
              <div className="flex flex-col gap-[10px]">
                {uploadItems.map((item) => (
                  <div
                    key={item.id}
                    className="w-full flex flex-row items-center gap-4 px-4 py-[20px] rounded-3xl border border-black/10"
                    style={{ background: 'rgba(255, 255, 255, 0.34)', backdropFilter: 'blur(44px)', WebkitBackdropFilter: 'blur(44px)' }}
                    aria-live="polite"
                  >
                    <div
                      className={`statement-file-loader${item.status === "queued" ? " is-queued" : ""}${item.status === "uploading" ? " is-uploading" : ""}${item.status === "complete" ? " is-uploaded" : ""}${item.status === "review" ? " is-review" : ""}${item.status === "error" || item.status === "password" ? " is-error" : ""}`}
                      style={{ "--upload-progress": `${item.progress}%` } as CSSProperties}
                    >
                      {item.status === "complete" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : item.status === "review" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.0784 19.0784L16.25 16.25M19.0784 4.99994L16.25 7.82837M4.92157 19.0784L7.75 16.25M4.92157 4.99994L7.75 7.82837" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : item.status === "password" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : item.status === "error" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="none">
                          <path d="M8 4V8M8 10.6667V12M14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8C1.33333 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-[2px] min-w-0">
                      <strong className="font-satoshi text-[15px] font-semibold leading-[150%] tracking-[-0.3px] text-black overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontFeatureSettings: "'ss03' on" }}>{item.name}</strong>
                      <span className="font-satoshi text-[13px] font-medium leading-[150%] tracking-[-0.26px] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
                        {item.status === "complete"
                          ? item.detail ?? formatFileSize(item.size)
                          : item.status === "error" || item.status === "review" || item.status === "password"
                            ? item.error
                            : item.detail ?? formatFileSize(item.size)
                        }
                      </span>
                    </div>
                    {item.status === "password" && item.documentId && (
                      <button
                        type="button"
                        className="flex-shrink-0 flex items-center justify-center h-8 rounded-full bg-black px-4 font-satoshi text-[13px] font-bold text-white cursor-pointer border-0 transition-colors hover:bg-black/85"
                        style={{ fontFeatureSettings: "'ss03' on" }}
                        onClick={() => handleRetryPassword(item.id, item.documentId!)}
                      >
                        Unlock
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed border-0"
                      onClick={() => removeUploadItem(item.id)}
                      aria-label="Remove selected file"
                      disabled={isUploading && item.status === "uploading"}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.3337 4.66669L4.66699 11.3334M4.66699 4.66669L11.3337 11.3334" stroke="black" strokeOpacity="0.7" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}


            {/* Submit */}
            <div className="flex gap-4 items-center flex-wrap lg:flex-col lg:items-start lg:gap-3 lg:w-full">
              <button
                className="flex items-center justify-center gap-[15px] w-full border-0 rounded-full bg-black text-white font-satoshi text-base font-bold leading-6 px-5 min-h-[64px] cursor-pointer disabled:opacity-30 max-[768px]:min-h-[54px] max-[768px]:py-[14px] max-[768px]:px-[18px]"
                style={{ fontFeatureSettings: "'ss03' on" }}
                type="button"
                onClick={hasCompletedUploads ? () => {
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_SEE_ONEVIEW,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  router.replace("/onboarding/processing");
                } : undefined}
                disabled={!hasCompletedUploads || isUploading}
                aria-busy={isUploading}
              >
                See your unified view
                <ArrowRightIcon />
              </button>
            </div>

            {error ? (
              <p className="mt-[10px] mb-[10px] font-satoshi text-[0.875rem] font-extrabold text-[#a40000]" style={{ fontFeatureSettings: "'ss03' on" }}>
                {error}
              </p>
            ) : null}
            {message ? (
              <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[#0a6b3f] px-6 py-3 font-satoshi text-[14px] font-medium text-white shadow-lg animate-[fadeInUp_0.3s_ease-out_both]" style={{ fontFeatureSettings: "'ss03' on" }}>
                {message}
              </div>
            ) : null}
          </div>
        </div>
      </section>

    </main>

      <DownloadInstructionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <OneviewInfoModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
      />

      <PasswordPromptModal
        isOpen={showPasswordPrompt}
        isLoading={isRetryingPassword}
        error={passwordError}
        onSubmit={handlePasswordSubmit}
        onClose={handlePasswordPromptClose}
      />
    </>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
      <path
        d="M12.333 12.333L15.666 9m0 0L12.333 5.667M15.666 9H6.333M6.333 2.333H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 00-.874.874c-.218.428-.218.988-.218 2.108v7.934c0 1.12 0 1.68.218 2.108a2 2 0 00.874.874c.428.218.988.218 2.108.218h1.133"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14.9997 2.14258H2.14258M4.28544 9.28544L8.57115 4.99972L12.8569 9.28544M8.57115 4.99972V14.9997" stroke="black" strokeOpacity="0.7" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getUploadCompleteDetail(positionsCount: number | undefined, size: number) {
  if (typeof positionsCount !== "number") {
    return formatFileSize(size);
  }
  return `${positionsCount} holding${positionsCount === 1 ? "" : "s"} • ${formatFileSize(size)}`;
}
