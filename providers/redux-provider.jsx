'use client';

import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import ReactGA from 'react-ga4';
import { persistor, store } from '@/redux/store';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function ReduxProvider({ children }) {
  const gaInitializedRef = useRef(false);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    if (typeof window === 'undefined') return;
    if (gaInitializedRef.current) return;
    gaInitializedRef.current = true;
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
