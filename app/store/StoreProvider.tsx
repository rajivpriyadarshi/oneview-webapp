"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { hydrateUploadTray, loadPersistedUploadTrayState } from "./uploadTraySlice";

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    store.dispatch(hydrateUploadTray(loadPersistedUploadTrayState()));
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
