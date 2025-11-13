'use client';

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { signIn, signOut } from 'next-auth/react';
import {
  getMe,
  loginRequest,
  logoutRequest,
  refreshAccessToken,
} from '@/lib/api-client';

const initialState = {
  user: null,
  accessToken: null,
  status: 'idle', // idle | loading | succeeded | failed
  error: null,
};

export const loginWithPassword = createAsyncThunk(
  'auth/loginWithPassword',
  async (
    { email, password, rememberme = true, device = 'web', deviceid },
    { rejectWithValue },
  ) => {
    try {
      const resp = await loginRequest({
        email,
        password,
        rememberme,
        device,
        deviceid,
      });
      const data = resp?.data ?? resp;
      const accessToken = data?.accessToken;
      const userid = data?.userid;

      if (!accessToken) {
        return rejectWithValue({ message: 'accessToken missing from response' });
      }

      await signIn('ExternalCredentials', {
        redirect: false,
        email,
        accessToken,
        name: data?.info?.name,
        userid,
      });

      let profile = null;
      try {
        const meResp = await getMe(accessToken);
        profile = meResp?.data ?? meResp;
      } catch (_) {}

      const user = profile?.profile || {
        id: userid,
        email,
        name: data?.info?.name,
        ...data?.info,
      };

      return { accessToken, user };
    } catch (err) {
      return rejectWithValue({
        message: err?.message || 'Login failed',
        status: err?.status,
      });
    }
  },
);

export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { getState, rejectWithValue }) => {
    try {
      const resp = await refreshAccessToken();
      const data = resp?.data ?? resp;
      const accessToken = data?.accessToken;
      if (!accessToken) {
        return rejectWithValue({ message: 'accessToken missing' });
      }

      const state = getState();
      const email = state?.auth?.user?.email;
      await signIn('ExternalCredentials', {
        redirect: false,
        email,
        accessToken,
        name: state?.auth?.user?.name,
        userid: state?.auth?.user?.id,
      });

      return { accessToken };
    } catch (err) {
      return rejectWithValue({
        message: err?.message || 'Refresh failed',
        status: err?.status,
      });
    }
  },
);

export const performLogout = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState()?.auth?.accessToken;
      if (token) {
        await logoutRequest(token);
      }
      await signOut({ redirect: false });
      return true;
    } catch (err) {
      return rejectWithValue({ message: err?.message || 'Logout failed' });
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithPassword.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginWithPassword.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(loginWithPassword.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Login failed';
      })
      .addCase(refreshSession.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
      })
      .addCase(performLogout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'idle';
        state.error = null;
      });
  },
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;

export const selectAuth = (state) => state.auth;
