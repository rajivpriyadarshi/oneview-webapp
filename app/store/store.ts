import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api";
import uploadTrayReducer from "./uploadTraySlice";

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    uploadTray: uploadTrayReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
