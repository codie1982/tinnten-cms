'use client';

import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import uiReducer from './slices/uiSlice';
import authReducer from './slices/authSlice';

const rootReducer = combineReducers({
  ui: uiReducer,
  auth: authReducer,
});

export function makeStore(preloadedState) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export const store = makeStore();

export const selectUi = (state) => state.ui;
export const selectAuth = (state) => state.auth;
