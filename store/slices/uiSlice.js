'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: false,
  theme: 'system',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebar(state, action) {
      state.sidebarOpen = !!action.payload;
    },
    setTheme(state, action) {
      state.theme = action.payload || 'system';
    },
  },
});

export const { toggleSidebar, setSidebar, setTheme } = uiSlice.actions;
export default uiSlice.reducer;

