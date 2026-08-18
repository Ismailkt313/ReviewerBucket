import { env } from "./env.js";

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (origin === env.CLIENT_URL) return true;
  if (env.NODE_ENV === "development") {
    // Allow any localhost or 127.0.0.1 port in development mode
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return true;
    }
  }
  return false;
}

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-anonymous-client-id"],
  credentials: true
};
