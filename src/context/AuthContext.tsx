import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { StaffProfile, UserRole } from '../types';
import { disableStaffPush, isStaffPushEnabled } from '../services/push.service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: StaffProfile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isCuisine: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const profileRef = React.useRef<StaffProfile | null>(null);

  const updateProfileState = (next: StaffProfile | null) => {
    const prev = profileRef.current;
    if (
      prev &&
      next &&
      prev.id === next.id &&
      prev.role === next.role &&
      prev.full_name === next.full_name &&
      prev.is_active === next.is_active
    ) {
      return;
    }
    profileRef.current = next;
    setProfile(next);
  };

  const fetchProfile = async (userId: string, isBackgroundCheck = false) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching staff profile', error);
        if (!isBackgroundCheck && !profileRef.current) {
          updateProfileState(null);
        }
        return profileRef.current;
      }

      // Deactivation check: If user is inactive, force signOut immediately
      if (!data.is_active) {
        console.warn('User account is deactivated. Signing out immediately.');
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        updateProfileState(null);
        return null;
      }

      const prof: StaffProfile = {
        id: data.id,
        role: data.role as UserRole,
        full_name: data.full_name,
        is_active: data.is_active,
        created_at: data.created_at,
      };
      updateProfileState(prof);
      return prof;
    } catch (e) {
      console.error('Unexpected error fetching profile', e);
      if (!isBackgroundCheck && !profileRef.current) {
        updateProfileState(null);
      }
      return profileRef.current;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initial session retrieval
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (!mounted) return;
      setSession((prev) => (prev?.access_token === initSession?.access_token ? prev : initSession));
      setUser((prev) => (prev?.id === initSession?.user?.id ? prev : (initSession?.user ?? null)));
      if (initSession?.user) {
        fetchProfile(initSession.user.id, false).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen to auth changes without unmounting active workspaces on tab focus or token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setSession(null);
        setUser(null);
        updateProfileState(null);
        setIsLoading(false);
        return;
      }

      setSession((prev) => (prev?.access_token === nextSession.access_token ? prev : nextSession));
      setUser((prev) => (prev?.id === nextSession.user.id ? prev : nextSession.user));

      // If we already have the profile for this user, don't block or reset on tab focus / TOKEN_REFRESHED
      if (profileRef.current && profileRef.current.id === nextSession.user.id) {
        setIsLoading(false);
        return;
      }

      await fetchProfile(nextSession.user.id, true);
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const prof = await fetchProfile(data.user.id);
        if (!prof) {
          await supabase.auth.signOut();
          return { error: 'Compte non autorisé ou inactif pour le personnel.' };
        }
        setUser(data.user);
        if (data.session) {
          setSession(data.session);
        }
      }

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion.';
      return { error: msg };
    }
  };

  const signOut = async () => {
    // A signed-out device must stop receiving staff alerts (shared tablets, lost phones…).
    try {
      if (isStaffPushEnabled()) await disableStaffPush();
    } catch {
      // never block logout because of notifications
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    updateProfileState(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const rawRole = profile?.is_active ? (profile.role as unknown as string) : null;
  const role: UserRole | null =
    rawRole === 'admin'
      ? 'admin'
      : rawRole === 'cuisine' ||
        rawRole === 'caisse' ||
        rawRole === 'cashier' ||
        rawRole === 'bar'
      ? 'cuisine'
      : null;
  const isAdmin = role === 'admin';
  const isCuisine = role === 'cuisine';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isAdmin,
        isCuisine,
        isLoading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
