
import { useEffect, useRef } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { syncUp, syncDown, getCurrentSession, logoutUser } from '../services/supabaseApi';
import { supabase } from '../lib/supabase';

export const useSync = () => {
  const { state, dispatch } = useCalculator();
  const { session, appData, ui } = state;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedStateRef = useRef<string>("");

  // 1. SESSION RECOVERY — use Supabase auth state instead of localStorage
  useEffect(() => {
    const recoverSession = async () => {
      try {
        const userSession = await getCurrentSession();
        if (userSession) {
          dispatch({ type: 'SET_SESSION', payload: userSession });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (e) {
        console.error('Session recovery failed:', e);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    recoverSession();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  // 2. CLOUD-FIRST INITIALIZATION
  useEffect(() => {
    if (!session) return;

    const initializeApp = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      try {
          // Attempt Fetch from Cloud (Source of Truth)
          const cloudData = await syncDown();
          
          if (cloudData) {
            // Deep merge cloud data over default state
            const mergedState = {
                ...DEFAULT_STATE,
                ...cloudData,
                companyProfile: { ...DEFAULT_STATE.companyProfile, ...(cloudData.companyProfile || {}) },
                warehouse: { ...DEFAULT_STATE.warehouse, ...(cloudData.warehouse || {}) },
                yields: { ...DEFAULT_STATE.yields, ...(cloudData.yields || {}) },
            };

            dispatch({ type: 'LOAD_DATA', payload: mergedState });
            dispatch({ type: 'SET_INITIALIZED', payload: true }); 
            lastSyncedStateRef.current = JSON.stringify(mergedState);
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });

          } else {
            throw new Error("Empty response from cloud");
          }
      } catch (e) {
          console.error("Cloud sync failed:", e);
          
          // Fallback: If cloud fails (offline), try Local Storage
          const localSaved = localStorage.getItem(`foamProState_${session.email}`);
          
          if (localSaved) {
              const localState = JSON.parse(localSaved);
              dispatch({ type: 'LOAD_DATA', payload: localState });
              dispatch({ type: 'SET_INITIALIZED', payload: true });
              dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Offline Mode: Using local backup.' } });
          } else {
              // New User or Total Failure: Load Defaults
              dispatch({ type: 'LOAD_DATA', payload: DEFAULT_STATE });
              dispatch({ type: 'SET_INITIALIZED', payload: true });
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Sync Failed. Using Defaults.' } });
          }
      } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
          setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
      }
    };

    initializeApp();
  }, [session, dispatch]);

  // 3. AUTO-SYNC (Write to Cloud)
  useEffect(() => {
    if (ui.isLoading || !ui.isInitialized || !session) return;
    if (session.role === 'crew') return;

    const currentStateStr = JSON.stringify(appData);
    
    // Always backup to local storage
    localStorage.setItem(`foamProState_${session.email}`, currentStateStr);

    // If state hasn't changed from what we last saw from/sent to cloud, do nothing
    if (currentStateStr === lastSyncedStateRef.current) return;

    // Debounce the Cloud Sync
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'pending' });
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      const success = await syncUp(appData);
      
      if (success) {
        lastSyncedStateRef.current = currentStateStr;
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
      } else {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      }
    }, 3000); 

    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [appData, ui.isLoading, ui.isInitialized, session, dispatch]);

  // 4. MANUAL FORCE SYNC
  const handleManualSync = async () => {
    if (!session) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    
    const success = await syncUp(appData);
    
    if (success) {
      lastSyncedStateRef.current = JSON.stringify(appData);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Cloud Sync Complete' } });
      setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
    } else {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Sync Failed. Check Internet.' } });
    }
  };

  return { handleManualSync };
};
