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
    },
    patchTrayItem(state, action: PayloadAction<{ id: string } & Partial<TrayItem>>) {
      const { id, ...patch } = action.payload;
      const item = state.items.find((i) => i.id === id);
      if (item) Object.assign(item, patch);
    },
    removeTrayItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    dismissTray(state) {
      state.dismissed = true;
      state.items = [];
    },
  },
});

export const { addTrayItems, patchTrayItem, removeTrayItem, dismissTray } =
  uploadTraySlice.actions;
export default uploadTraySlice.reducer;
