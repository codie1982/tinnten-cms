'use client';

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistReducer, persistStore } from 'redux-persist';
import storage from '@/lib/storage';
import authReducer from './features/authSlice';
import uiReducer from './features/uiSlice';
import { baseApi } from './services/baseApi';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  // RTK Query — tüm API kaynakları tek reducerPath altında
  [baseApi.reducerPath]: baseApi.reducer,
});

const persistConfig = {
  key: 'root',
  storage,
  // API cache'i persist edilmez (yalnızca seçili client state)
  whitelist: [],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== 'production',
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(baseApi.middleware),
});

// RTK Query refetchOnFocus / refetchOnReconnect davranışını etkinleştirir
setupListeners(store.dispatch);

export const persistor = persistStore(store);

export const selectAuth = (state) => state.auth;
export const selectUi = (state) => state.ui;
