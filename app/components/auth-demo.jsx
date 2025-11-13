'use client';

import { useDispatch, useSelector } from 'react-redux';
import { loginWithPassword, performLogout } from '@/store/slices/authSlice';
import { selectAuth } from '@/store/store';
import { useState } from 'react';

export default function AuthDemo() {
  const dispatch = useDispatch();
  const { user, accessToken, status, error } = useSelector(selectAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="p-4 border rounded-md space-y-2">
      <div className="font-semibold">Auth Demo (Redux)</div>
      <div className="text-sm">Status: {status}</div>
      {error && <div className="text-red-600 text-sm">{String(error)}</div>}
      <div className="text-xs break-all">Token: {accessToken ? accessToken.slice(0, 20) + '…' : '-'}</div>
      <div className="text-xs">User: {user ? user?.email || user?.name || user?.id : '-'}</div>
      <div className="flex gap-2 items-center">
        <input className="border px-2 py-1" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border px-2 py-1" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          className="btn btn-primary"
          onClick={() => dispatch(loginWithPassword({ email, password, rememberme: true, device: 'web' }))}
          disabled={status === 'loading'}
        >
          Login
        </button>
        <button className="btn" onClick={() => dispatch(performLogout())}>Logout</button>
      </div>
    </div>
  );
}

