import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { useAppDispatch, useAppSelector } from './redux';

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

describe('useAppDispatch / useAppSelector', () => {
  it('useAppDispatch returns the store\'s dispatch function', () => {
    const { result } = renderHook(() => useAppDispatch(), { wrapper });
    expect(result.current).toBe(store.dispatch);
  });

  it('useAppSelector reads state from the store', () => {
    const { result } = renderHook(() => useAppSelector((state) => state.auth), { wrapper });
    expect(result.current).toEqual(store.getState().auth);
  });
});
