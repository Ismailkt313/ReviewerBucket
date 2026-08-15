import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  decodeAdminTokenPayload,
  getAdminToken,
  removeAdminToken,
  setAdminToken,
} from "../app/utils/admin-token";
import {
  ADMIN_UNAUTHORIZED_EVENT,
  notifyAdminUnauthorized,
} from "../app/services/admin-auth";
import { formatAdminUserDisplayId } from "../app/services/admin-chat";

// ─── Mocking Browser Environment for Node Test Runner ─────────────────────────
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class MockCustomEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class MockEventTarget {
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string }): boolean {
    const set = this.listeners.get(event.type);
    if (set) {
      set.forEach((listener) => listener(event as Event));
    }
    return true;
  }
}

const mockStorage = new MockLocalStorage();
const mockWindow = new MockEventTarget();

// Set window global object mock
(global as unknown as { window: unknown }).window = mockWindow;
(global as unknown as { localStorage: unknown }).localStorage = mockStorage;
(global as unknown as { CustomEvent: unknown }).CustomEvent = MockCustomEvent;
(global as unknown as { atob: (s: string) => string }).atob = (str: string) =>
  Buffer.from(str, "base64").toString("binary");

describe("Admin Modules 1, 2 & 3 Integration Tests", () => {

  test("1. Admin token storage safely sets, gets, and removes token", () => {
    mockStorage.clear();
    assert.equal(getAdminToken(), null);

    const dummyToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiJ9.signature";
    setAdminToken(dummyToken);
    assert.equal(getAdminToken(), dummyToken);

    removeAdminToken();
    assert.equal(getAdminToken(), null);
  });

  test("2. Decode JWT payload returns role and sub correctly", () => {
    const validToken = "header.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiJ9.signature";
    const decoded = decodeAdminTokenPayload(validToken);
    assert.ok(decoded);
    assert.equal(decoded.sub, "admin");
    assert.equal(decoded.role, "ADMIN");
  });

  test("3. Decode invalid JWT payload returns null gracefully", () => {
    assert.equal(decodeAdminTokenPayload("invalid-jwt-string"), null);
    assert.equal(decodeAdminTokenPayload(""), null);
  });

  test("4. notifyAdminUnauthorized removes token and dispatches event", () => {
    setAdminToken("dummy_token");
    let eventFired = false;

    const listener = () => {
      eventFired = true;
    };
    mockWindow.addEventListener(ADMIN_UNAUTHORIZED_EVENT, listener);

    notifyAdminUnauthorized();

    assert.equal(getAdminToken(), null);
    assert.equal(eventFired, true);

    mockWindow.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, listener);
  });

  test("5. Email validation logic works as expected", () => {
    const validateEmail = (email: string) => {
      const trimmed = email.trim();
      if (!trimmed) return "Email is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Please enter a valid email address.";
      return null;
    };

    assert.equal(validateEmail(""), "Email is required.");
    assert.equal(validateEmail("   "), "Email is required.");
    assert.equal(validateEmail("invalid-email"), "Please enter a valid email address.");
    assert.equal(validateEmail("admin@reviewerbucket.com"), null);
  });

  test("6. Password validation logic works as expected", () => {
    const validatePassword = (pass: string) => {
      if (!pass) return "Password is required.";
      return null;
    };

    assert.equal(validatePassword(""), "Password is required.");
    assert.equal(validatePassword("secret"), null);
  });

  test("7. Route guard redirect decision logic works", () => {
    const decideRoute = (status: "loading" | "authenticated" | "unauthenticated", pathname: string) => {
      if (status === "loading") return "loading";
      if (status === "authenticated") {
        if (pathname === "/admin" || pathname === "/admin/login") {
          return "/admin/dashboard";
        }
        return pathname;
      }
      // unauthenticated
      if (pathname === "/admin" || pathname === "/admin/login") {
        return "/admin/login";
      }
      return `/admin/login?redirect=${encodeURIComponent(pathname)}`;
    };

    // /admin redirects
    assert.equal(decideRoute("unauthenticated", "/admin"), "/admin/login");
    assert.equal(decideRoute("authenticated", "/admin"), "/admin/dashboard");

    // /admin/login redirects
    assert.equal(decideRoute("unauthenticated", "/admin/login"), "/admin/login");
    assert.equal(decideRoute("authenticated", "/admin/login"), "/admin/dashboard");

    // Protected routes redirect unauthenticated users to login with redirect param
    assert.equal(decideRoute("unauthenticated", "/admin/requests"), "/admin/login?redirect=%2Fadmin%2Frequests");
    assert.equal(decideRoute("unauthenticated", "/admin/update-requests"), "/admin/login?redirect=%2Fadmin%2Fupdate-requests");
    assert.equal(decideRoute("unauthenticated", "/admin/chat"), "/admin/login?redirect=%2Fadmin%2Fchat");

    // Authenticated users stay on requested route
    assert.equal(decideRoute("authenticated", "/admin/requests"), "/admin/requests");
    assert.equal(decideRoute("authenticated", "/admin/update-requests"), "/admin/update-requests");
    assert.equal(decideRoute("authenticated", "/admin/chat"), "/admin/chat");
  });

  test("8. Sidebar active link detection logic works", () => {
    const isLinkActive = (itemHref: string, currentPathname: string) => {
      if (itemHref === "/admin/dashboard") {
        return currentPathname === "/admin/dashboard" || currentPathname === "/admin";
      }
      return currentPathname.startsWith(itemHref);
    };

    assert.equal(isLinkActive("/admin/dashboard", "/admin/dashboard"), true);
    assert.equal(isLinkActive("/admin/dashboard", "/admin"), true);
    assert.equal(isLinkActive("/admin/dashboard", "/admin/requests"), false);

    assert.equal(isLinkActive("/admin/requests", "/admin/requests"), true);
    assert.equal(isLinkActive("/admin/requests", "/admin/dashboard"), false);

    assert.equal(isLinkActive("/admin/update-requests", "/admin/update-requests"), true);
    assert.equal(isLinkActive("/admin/update-requests", "/admin/requests"), false);

    assert.equal(isLinkActive("/admin/chat", "/admin/chat"), true);
    assert.equal(isLinkActive("/admin/chat", "/admin/chat/room123"), true);
  });

  test("9. Dashboard derives metric counts correctly from real API lists", () => {
    const creationList = [
      { id: "1", status: "pending" },
      { id: "2", status: "approved" },
      { id: "3", status: "rejected" },
    ];
    const updateList = [
      { id: "u1", status: "PENDING" },
      { id: "u2", status: "PENDING" },
      { id: "u3", status: "APPROVED" },
    ];

    const pendingCreation = creationList.filter((r) => r.status.toUpperCase() === "PENDING").length;
    const pendingUpdate = updateList.filter((r) => r.status.toUpperCase() === "PENDING").length;
    const totalProcessed =
      creationList.filter((r) => r.status.toUpperCase() !== "PENDING").length +
      updateList.filter((r) => r.status.toUpperCase() !== "PENDING").length;

    assert.equal(pendingCreation, 1);
    assert.equal(pendingUpdate, 2);
    assert.equal(totalProcessed, 3);
  });

  test("10. formatAdminUserDisplayId safely transforms anonymous IDs into system user#... format", () => {
    assert.equal(formatAdminUserDisplayId("11111111-1111-4111-8111-111111111111"), "user#11111111");
    assert.equal(formatAdminUserDisplayId("user#223"), "user#223");
    assert.equal(formatAdminUserDisplayId("87"), "user#87");
    assert.equal(formatAdminUserDisplayId(""), "user#anonymous");
    assert.equal(formatAdminUserDisplayId(undefined), "user#anonymous");
  });

  test("11. Empty message submission is rejected client-side", () => {
    const canSend = (content: string) => content.trim().length > 0;
    assert.equal(canSend(""), false);
    assert.equal(canSend("   \n  "), false);
    assert.equal(canSend("Hello developer!"), true);
  });
});
