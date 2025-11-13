'use client';

import { useSelector, useDispatch } from 'react-redux';
import { selectUi } from '@/store/store';
import { toggleSidebar } from '@/store/slices/uiSlice';

export default function ReduxDemo() {
  const { sidebarOpen } = useSelector(selectUi);
  const dispatch = useDispatch();
  return (
    <div className="p-4 border rounded-md">
      <div className="mb-2">Sidebar: {sidebarOpen ? 'Open' : 'Closed'}</div>
      <button className="btn btn-primary" onClick={() => dispatch(toggleSidebar())}>
        Toggle Sidebar
      </button>
    </div>
  );
}

