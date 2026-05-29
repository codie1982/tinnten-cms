'use client';

import { useDispatch, useSelector } from 'react-redux';

/**
 * Standart Redux hook'ları (JS projesi — tip sarmalayıcısı gerekmez).
 * RTK Query kaynak hook'ları için `@/redux/services` kullanın.
 */
export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
