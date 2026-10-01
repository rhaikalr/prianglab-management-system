import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';

const DEFAULT_ADMIN: UserProfile = {
  id: 'admin_1',
  name: 'RAIA HAIKAL RABBANI',
  username: 'admin',
  role: 'ADMIN',
  roleTitle: 'Administrator Gudang & Ekspedisi',
};

interface AuthContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  login: (u: string, p: string) => { success: boolean; message?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_AUTH_KEY = 'prianglab_is_logged_in_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(LS_AUTH_KEY) === 'true';
  });

  const [currentUser] = useState<UserProfile>(DEFAULT_ADMIN);

  useEffect(() => {
    // Silently authenticate with Firebase to ensure real-time Firestore multi-device sync
    signInAnonymously(auth).catch((err) => {
      console.warn('Anonymous auth sync info:', err);
    });
  }, []);

  const login = (u: string, p: string) => {
    const cleanU = u.trim().toLowerCase();
    const cleanP = p.trim();

    if (cleanU === 'admin' && cleanP === 'admin123') {
      setIsAuthenticated(true);
      localStorage.setItem(LS_AUTH_KEY, 'true');
      return { success: true };
    }
    return {
      success: false,
      message: 'Username atau Password salah! (Gunakan username: admin & password: admin123)',
    };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(LS_AUTH_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
