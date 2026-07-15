const STORAGE_KEY = "reviewerBucket:anonymousClientId";

export function getAnonymousClientId(): string {
  if (typeof window === "undefined") return "";

  let clientId = localStorage.getItem(STORAGE_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, clientId);
  }
  return clientId;
}
