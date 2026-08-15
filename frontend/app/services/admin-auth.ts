import { getApiUrl } from "../utils/api";
import { getAdminToken, removeAdminToken } from "../utils/admin-token";

export interface AdminLoginCredentials {
  email: string;
  password: string;
}

export interface AdminAuthResponseData {
  token: string;
  admin: {
    role: "ADMIN";
  };
}

export const ADMIN_UNAUTHORIZED_EVENT = "admin:unauthorized";

/**
 * Dispatch global unauthorized event when backend rejects admin credentials/token with 401.
 */
export function notifyAdminUnauthorized(): void {
  if (typeof window !== "undefined") {
    removeAdminToken();
    window.dispatchEvent(new CustomEvent(ADMIN_UNAUTHORIZED_EVENT));
  }
}

/**
 * Call backend Admin Authentication API: POST /api/admin/auth/login
 */
export async function loginAdminApi(
  credentials: AdminLoginCredentials
): Promise<AdminAuthResponseData> {
  let res: Response;
  try {
    res = await fetch(getApiUrl("/api/admin/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(credentials)
    });
  } catch {
    throw new Error("Unable to connect to server. Please check your network connection.");
  }

  let json: {
    success?: boolean;
    data?: AdminAuthResponseData;
    message?: string;
    error?: { message?: string };
  };

  try {
    json = await res.json();
  } catch {
    throw new Error("Invalid response received from authentication server.");
  }

  if (!res.ok || !json.success || !json.data?.token) {
    const errorMsg = json.error?.message || json.message;
    if (res.status === 401 || (errorMsg && errorMsg.toLowerCase().includes("invalid"))) {
      throw new Error("Invalid email or password.");
    }
    throw new Error(errorMsg || "Authentication failed. Please try again.");
  }

  return json.data;
}

/**
 * Authenticated fetch helper for admin protected requests.
 * Automatically injects Bearer token and handles 401 status.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    notifyAdminUnauthorized();
  }

  return res;
}
