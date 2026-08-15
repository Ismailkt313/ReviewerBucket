const ADMIN_TOKEN_KEY = "admin_token";

export interface DecodedAdminToken {
  sub?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Safely retrieve admin token from localStorage.
 */
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Safely persist admin JWT token in localStorage.
 */
export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // ignore storage write errors
  }
}

/**
 * Safely remove admin token from localStorage.
 */
export function removeAdminToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore storage removal errors
  }
}

/**
 * Decodes the JWT payload without full signature verification (server remains authority).
 */
export function decodeAdminTokenPayload(token: string): DecodedAdminToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as DecodedAdminToken;
  } catch {
    return null;
  }
}
