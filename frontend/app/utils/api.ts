const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://reviewerbucket.vercel.app";

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
}
