import { getApiUrl } from "../utils/api";
import { getAnonymousClientId } from "../utils/anonymous-id";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface ContactIdentityResponse {
  contactId: string;
  displayName: string;
  nickname: string | null;
  isCustomName: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RenameContactDTO {
  nickname?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientId(): string {
  const clientId = getAnonymousClientId();
  if (!clientId) throw new Error("Anonymous session not found. Please refresh the page.");
  return clientId;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json();
    if (json?.message) return json.message;
    if (json?.error) return json.error;
  } catch {
    // ignore
  }
  return fallback;
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getContactIdentity(
  contactId: string
): Promise<ContactIdentityResponse> {
  const clientId = getClientId();

  const res = await fetch(getApiUrl(`/api/private-contacts/${contactId}`), {
    headers: { "x-anonymous-client-id": clientId }
  });

  if (res.status === 404) {
    return {
      contactId,
      displayName: "Anonymous User",
      nickname: null,
      isCustomName: false
    };
  }

  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load contact identity."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as ContactIdentityResponse;
}

export async function renameContact(
  contactId: string,
  nickname: string | null
): Promise<ContactIdentityResponse> {
  const clientId = getClientId();

  const res = await fetch(getApiUrl(`/api/private-contacts/${contactId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-anonymous-client-id": clientId
    },
    body: JSON.stringify({ nickname })
  });

  if (res.status === 409) {
    throw new Error("This name is already used for another private contact.");
  }

  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to update contact name."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as ContactIdentityResponse;
}

export async function getMyContacts(
  limit = 50
): Promise<ContactIdentityResponse[]> {
  const clientId = getClientId();

  const res = await fetch(getApiUrl(`/api/private-contacts?limit=${limit}`), {
    headers: { "x-anonymous-client-id": clientId }
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load contacts."));
  }

  const json = await res.json();
  if (!Array.isArray(json?.data)) throw new Error("Unexpected response from server.");
  return json.data as ContactIdentityResponse[];
}
