"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminToken,
  setAdminToken,
  removeAdminToken,
  decodeAdminTokenPayload,
} from "../utils/admin-token";
import {
  loginAdminApi,
  AdminLoginCredentials,
  ADMIN_UNAUTHORIZED_EVENT,
} from "../services/admin-auth";

export type AdminAuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AdminAuthContextType {
  status: AdminAuthStatus;
  token: string | null;
  role: "ADMIN" | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AdminLoginCredentials) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

function checkInitialAuthState(): {
  status: AdminAuthStatus;
  token: string | null;
  role: "ADMIN" | null;
} {
  if (typeof window === "undefined") {
    return { status: "loading", token: null, role: null };
  }

  const storedToken = getAdminToken();
  if (!storedToken) {
    return { status: "unauthenticated", token: null, role: null };
  }

  const payload = decodeAdminTokenPayload(storedToken);
  if (payload && payload.role === "ADMIN") {
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      removeAdminToken();
      return { status: "unauthenticated", token: null, role: null };
    }
    return { status: "authenticated", token: storedToken, role: "ADMIN" };
  }

  removeAdminToken();
  return { status: "unauthenticated", token: null, role: null };
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [{ status, token, role }, setAuthState] = useState<{
    status: AdminAuthStatus;
    token: string | null;
    role: "ADMIN" | null;
  }>({
    status: "loading",
    token: null,
    role: null,
  });

  // Hydrate client state after mount
  useEffect(() => {
    const initialState = checkInitialAuthState();
    setAuthState(initialState);
  }, []);

  const logout = useCallback(() => {
    removeAdminToken();
    setAuthState({ status: "unauthenticated", token: null, role: null });
    router.push("/admin/login");
  }, [router]);

  useEffect(() => {
    const handleUnauthorized = () => {
      removeAdminToken();
      setAuthState({ status: "unauthenticated", token: null, role: null });
      router.push("/admin/login");
    };

    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [router]);

  const login = useCallback(async (credentials: AdminLoginCredentials) => {
    const authData = await loginAdminApi(credentials);
    setAdminToken(authData.token);
    setAuthState({
      status: "authenticated",
      token: authData.token,
      role: "ADMIN",
    });
  }, []);

  const value: AdminAuthContextType = {
    status,
    token,
    role,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    logout,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
