import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type TrayItemStatus = "queued" | "uploading" | "complete" | "error" | "review" | "password";

export type TrayItem = {
  id: string;
  name: string;
  size: number;
  status: TrayItemStatus;
  progress: number;
  detail?: string;
  error?: string;
  documentId?: string;
};

type UploadTrayState = {
  items: TrayItem[];
  dismissed: boolean;
};

const STORAGE_KEY = "uploadTray";

export function loadPersistedUploadTrayState(): UploadTrayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UploadTrayState;
    // On reload, any "uploading"/"queued" items are orphaned — keep them so reconciliation can resolve
    return {
      items: parsed.items.map((item) => ({
        ...item,
        // Reset progress since the upload fetch is gone
        progress: item.status === "uploading" || item.status === "queued" ? 0 : item.progress,
      })),
      dismissed: parsed.dismissed,
    };
  } catch {
    return null;
  }
}

function persistState(state: UploadTrayState) {
  if (typeof window === "undefined") return;
  try {
    // Only persist items that are mid-upload (server has the document). "queued" items never
    // started, so they can't be reconciled after refresh.
    const activeItems = state.items.filter(
      (i) => i.status === "uploading" && i.documentId,
    );
    if (activeItems.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: activeItems, dismissed: false }));
    }
  } catch {
    // localStorage unavailable
  }
}

const initialState: UploadTrayState = {
  items: [],
  dismissed: false,
};

export const uploadTraySlice = createSlice({
  name: "uploadTray",
  initialState,
  reducers: {
    addTrayItems(state, action: PayloadAction<TrayItem[]>) {
      const incoming = action.payload;
      const existingIds = new Set(state.items.map((i) => i.id));
      for (const item of incoming) {
        if (!existingIds.has(item.id)) {
          state.items.push(item);
        }
      }
      state.dismissed = false;
      persistState(state);
    },
    hydrateUploadTray(state, action: PayloadAction<UploadTrayState | null>) {
      if (!action.payload) return;
      state.items = action.payload.items;
      state.dismissed = action.payload.dismissed;
    },
    patchTrayItem(state, action: PayloadAction<{ id: string } & Partial<TrayItem>>) {
      const { id, ...patch } = action.payload;
      const item = state.items.find((i) => i.id === id);
      if (item) Object.assign(item, patch);
      persistState(state);
    },
    removeTrayItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
      persistState(state);
    },
    dismissTray(state) {
      state.dismissed = true;
      state.items = [];
      persistState(state);
    },
  },
});

export const { addTrayItems, hydrateUploadTray, patchTrayItem, removeTrayItem, dismissTray } =
  uploadTraySlice.actions;
export default uploadTraySlice.reducer;
