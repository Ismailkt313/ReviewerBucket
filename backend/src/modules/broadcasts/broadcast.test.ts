import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { connectDatabase } from "../../config/database.js";
import { BroadcastModel } from "./broadcast.model.js";
import { BroadcastService } from "./broadcast.service.js";
import { signJwt } from "../../utils/jwt.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";
import {
  createAdminBroadcast
} from "./broadcast.controller.js";
import {
  validateCreateBroadcast
} from "./broadcast.validation.js";
import { PrivateContactService } from "../private-contacts/private-contact.service.js";
import type { BroadcastCategory, BroadcastPriority, BroadcastAudience } from "./broadcast.types.js";

describe("Backend: Admin Broadcast Messaging & Domain Tests (Module 1)", () => {
  const broadcastService = new BroadcastService();
  const privateContactService = new PrivateContactService();

  const validAdminToken = signJwt({ sub: "admin", role: "ADMIN" }, env.JWT_SECRET);
  const nonAdminToken = signJwt({ sub: "user1", role: "USER" }, env.JWT_SECRET);

  before(async () => {
    await connectDatabase();
    await BroadcastModel.init();
    await BroadcastModel.deleteMany({});
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await BroadcastModel.deleteMany({});
  });

  // ─── 1. Broadcast Domain, Category, Priority & Title Persistence ──────────

  test("1. Authenticated admin can create a broadcast with all domain fields (title, category, priority, audience, type)", async () => {
    const payload = {
      adminId: "admin",
      title: "Private messaging is now live",
      content: "You can now continue conversations privately with other community members.",
      category: "FEATURE_UPDATE" as const,
      priority: "HIGH" as const,
      audience: "ALL_USERS" as const,
      deliveryMode: "ANNOUNCEMENT" as const
    };

    const broadcast = await broadcastService.createBroadcast(payload);

    assert.ok(broadcast.id);
    assert.equal(broadcast.title, "Private messaging is now live");
    assert.equal(broadcast.content, "You can now continue conversations privately with other community members.");
    assert.equal(broadcast.type, "SYSTEM_BROADCAST");
    assert.equal(broadcast.category, "FEATURE_UPDATE");
    assert.equal(broadcast.priority, "HIGH");
    assert.equal(broadcast.audience, "ALL_USERS");
    assert.equal(broadcast.deliveryMode, "ANNOUNCEMENT");
    assert.equal(broadcast.adminId, "admin");
    assert.ok(broadcast.createdAt);

    // Verify document in MongoDB
    const doc = await BroadcastModel.findById(broadcast.id);
    assert.ok(doc);
    assert.equal(doc.title, "Private messaging is now live");
    assert.equal(doc.content, "You can now continue conversations privately with other community members.");
    assert.equal(doc.type, "SYSTEM_BROADCAST");
    assert.equal(doc.category, "FEATURE_UPDATE");
    assert.equal(doc.priority, "HIGH");
    assert.equal(doc.audience, "ALL_USERS");
    assert.equal(doc.deliveryMode, "ANNOUNCEMENT");
  });

  test("2. Default category is COMMUNITY and default priority is NORMAL when omitted", async () => {
    const broadcast = await broadcastService.createBroadcast({
      adminId: "admin",
      content: "General community notice"
    });

    assert.equal(broadcast.category, "COMMUNITY");
    assert.equal(broadcast.priority, "NORMAL");
    assert.equal(broadcast.audience, "ALL_USERS");
    assert.equal(broadcast.type, "SYSTEM_BROADCAST");
  });

  test("3. Supports legacy positional parameters (adminId, content, deliveryMode)", async () => {
    const content = "Positional legacy broadcast call";
    const broadcast = await broadcastService.createBroadcast("admin", content, "ANNOUNCEMENT");

    assert.ok(broadcast.id);
    assert.equal(broadcast.content, content);
    assert.equal(broadcast.category, "COMMUNITY");
    assert.equal(broadcast.priority, "NORMAL");
    assert.equal(broadcast.deliveryMode, "ANNOUNCEMENT");
  });

  // ─── 2. Validation & Business Rule Tests ───────────────────────────────────

  test("4. Validation rejects empty content", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({ adminId: "admin", content: "" });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /empty/i);
        return true;
      }
    );
  });

  test("5. Validation rejects whitespace-only content", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({ adminId: "admin", content: "   \n\t  " });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /empty/i);
        return true;
      }
    );
  });

  test("6. Validation rejects content exceeding 2000 characters", async () => {
    const longContent = "A".repeat(2001);
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({ adminId: "admin", content: longContent });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /2000/i);
        return true;
      }
    );
  });

  test("7. Validation rejects invalid category strings", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({
          adminId: "admin",
          content: "Valid content",
          category: "RANDOM_CATEGORY" as unknown as BroadcastCategory
        });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /category/i);
        return true;
      }
    );
  });

  test("8. Validation rejects invalid priority strings (e.g. URGENT or color codes)", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({
          adminId: "admin",
          content: "Valid content",
          priority: "URGENT" as unknown as BroadcastPriority
        });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /priority/i);
        return true;
      }
    );
  });

  test("9. Validation rejects invalid audience (custom user arrays or segmentation)", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({
          adminId: "admin",
          content: "Valid content",
          audience: "CUSTOM_SEGMENT" as unknown as BroadcastAudience
        });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /audience/i);
        return true;
      }
    );
  });

  test("10. Validation rejects whitespace-only title when title is provided", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({
          adminId: "admin",
          title: "   ",
          content: "Valid content"
        });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /title/i);
        return true;
      }
    );
  });

  test("11. Validation rejects title exceeding 200 characters", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast({
          adminId: "admin",
          title: "T".repeat(201),
          content: "Valid content"
        });
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /200/i);
        return true;
      }
    );
  });

  // ─── 3. User Sanitization & System Identity ────────────────────────────────

  test("12. Public broadcast query returns sanitized system identity (Reviewer Bucket) and never leaks adminId/email/jwt", async () => {
    await broadcastService.createBroadcast({
      adminId: "admin-secret-uuid",
      title: "System Update",
      content: "Maintenance is complete.",
      category: "SYSTEM",
      priority: "CRITICAL"
    });

    const broadcasts = await broadcastService.getUserBroadcasts(10);
    assert.equal(broadcasts.length, 1);

    const first = broadcasts[0];
    assert.equal(first.senderName, "Reviewer Bucket");
    assert.equal(first.secondaryLabel, "Official announcement");
    assert.equal(first.title, "System Update");
    assert.equal(first.category, "SYSTEM");
    assert.equal(first.priority, "CRITICAL");
    assert.equal(first.type, "SYSTEM_BROADCAST");
    assert.equal(first.audience, "ALL_USERS");

    // Critical security check: Must NOT contain admin internal fields
    const untyped = first as unknown as Record<string, unknown>;
    assert.equal(untyped.adminId, undefined);
    assert.equal(untyped.email, undefined);
    assert.equal(untyped.jwt, undefined);
    assert.equal(untyped.sub, undefined);
  });

  // ─── 4. Admin History & Retrieval ──────────────────────────────────────────

  test("13. Admin can retrieve broadcast history with admin management fields", async () => {
    await broadcastService.createBroadcast({
      adminId: "admin",
      title: "Product Update",
      content: "New review filters added.",
      category: "PRODUCT_UPDATE",
      priority: "IMPORTANT"
    });

    const adminBroadcasts = await broadcastService.getAdminBroadcasts(10);
    assert.equal(adminBroadcasts.length, 1);
    assert.equal(adminBroadcasts[0].adminId, "admin");
    assert.equal(adminBroadcasts[0].category, "PRODUCT_UPDATE");
    assert.equal(adminBroadcasts[0].priority, "IMPORTANT");
    assert.equal(adminBroadcasts[0].title, "Product Update");

    const single = await broadcastService.getAdminBroadcastById(adminBroadcasts[0].id);
    assert.equal(single.id, adminBroadcasts[0].id);
    assert.equal(single.title, "Product Update");
  });

  test("14. Chronological ordering: broadcasts are returned newest first", async () => {
    await broadcastService.createBroadcast({
      adminId: "admin",
      title: "First Broadcast",
      content: "First content"
    });

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 50));

    await broadcastService.createBroadcast({
      adminId: "admin",
      title: "Second Broadcast",
      content: "Second content"
    });

    const publicBroadcasts = await broadcastService.getUserBroadcasts(10);
    assert.equal(publicBroadcasts.length, 2);
    assert.equal(publicBroadcasts[0].title, "Second Broadcast");
    assert.equal(publicBroadcasts[1].title, "First Broadcast");
  });

  // ─── 5. Controller & Middleware Authorization Tests ────────────────────────

  test("15. requireAdminAuth rejects unauthenticated requests (401)", () => {
    let nextError: unknown = null;
    const req = { headers: {} } as Request;
    const res = {} as Response;
    const next = (err?: unknown) => {
      nextError = err;
    };

    requireAdminAuth(req, res, next);
    assert.ok(nextError instanceof AppError);
    assert.equal((nextError as AppError).statusCode, 401);
  });

  test("16. requireAdminAuth rejects non-admin users (403)", () => {
    let nextError: unknown = null;
    const req = {
      headers: { authorization: `Bearer ${nonAdminToken}` }
    } as Request;
    const res = {} as Response;
    const next = (err?: unknown) => {
      nextError = err;
    };

    requireAdminAuth(req, res, next);
    assert.ok(nextError instanceof AppError);
    assert.equal((nextError as AppError).statusCode, 403);
  });

  test("17. requireAdminAuth allows valid admin token", () => {
    let nextCalled = false;
    let nextError: unknown = null;
    const req = {
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as Request;
    const res = {} as Response;
    const next = (err?: unknown) => {
      nextCalled = true;
      nextError = err;
    };

    requireAdminAuth(req, res, next);
    assert.equal(nextCalled, true);
    assert.equal(nextError, undefined);
    assert.equal(req.admin?.role, "ADMIN");
  });

  test("18. createAdminBroadcast controller returns 201 with category, priority, and title", async () => {
    let statusCode = 0;
    let jsonResponse: Record<string, unknown> | null = null;

    const req = {
      admin: { sub: "admin", role: "ADMIN" },
      body: {
        title: "Community Guidelines",
        content: "Please read our updated guidelines.",
        category: "IMPORTANT",
        priority: "HIGH",
        audience: "ALL_USERS",
        deliveryMode: "ANNOUNCEMENT"
      }
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: Record<string, unknown>) {
        jsonResponse = data;
        return this;
      }
    } as unknown as Response;

    await createAdminBroadcast(req, res, () => {});

    assert.equal(statusCode, 201);
    assert.ok(jsonResponse !== null);
    const body = jsonResponse as Record<string, unknown>;
    assert.equal(body.success, true);
    const broadcast = body.broadcast as Record<string, unknown>;
    assert.equal(broadcast.title, "Community Guidelines");
    assert.equal(broadcast.content, "Please read our updated guidelines.");
    assert.equal(broadcast.category, "IMPORTANT");
    assert.equal(broadcast.priority, "HIGH");
    assert.equal(broadcast.type, "SYSTEM_BROADCAST");
    assert.equal(broadcast.audience, "ALL_USERS");
  });

  test("19. validateCreateBroadcast middleware parses and defaults correctly", () => {
    let nextError: unknown = null;
    const req = {
      body: {
        content: "Valid announcement content."
      }
    } as Request;
    const res = {} as Response;
    const next = (err?: unknown) => {
      nextError = err;
    };

    validateCreateBroadcast(req, res, next);
    assert.equal(nextError, undefined);
    assert.equal(req.body.category, "COMMUNITY");
    assert.equal(req.body.priority, "NORMAL");
    assert.equal(req.body.audience, "ALL_USERS");
    assert.equal(req.body.deliveryMode, "ANNOUNCEMENT");
  });

  test("20. validateCreateBroadcast middleware rejects invalid category with 400", () => {
    let nextError: unknown = null;
    const req = {
      body: {
        content: "Valid announcement content.",
        category: "INVALID_CAT"
      }
    } as Request;
    const res = {} as Response;
    const next = (err?: unknown) => {
      nextError = err;
    };

    validateCreateBroadcast(req, res, next);
    assert.ok(nextError instanceof AppError);
    assert.equal((nextError as AppError).statusCode, 400);
    assert.match((nextError as AppError).message, /category/i);
  });

  test("21. validateCreateBroadcast middleware rejects invalid priority with 400", () => {
    let nextError: unknown = null;
    const req = {
      body: {
        content: "Valid announcement content.",
        priority: "LOWEST"
      }
    } as Request;
    const res = {} as Response;
    const next = (err?: unknown) => {
      nextError = err;
    };

    validateCreateBroadcast(req, res, next);
    assert.ok(nextError instanceof AppError);
    assert.equal((nextError as AppError).statusCode, 400);
    assert.match((nextError as AppError).message, /priority/i);
  });

  // ─── 6. Backward Compatibility for Legacy Documents ───────────────────────

  test("22. Legacy documents without category, priority, or title load with safe defaults", async () => {
    // Direct raw insertion to simulate legacy records in MongoDB
    await BroadcastModel.collection.insertOne({
      adminId: "admin",
      content: "Old legacy announcement",
      type: "SYSTEM_BROADCAST",
      audience: "ALL_USERS",
      deliveryMode: "ANNOUNCEMENT",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const publicList = await broadcastService.getUserBroadcasts(10);
    assert.equal(publicList.length, 1);
    assert.equal(publicList[0].content, "Old legacy announcement");
    assert.equal(publicList[0].type, "SYSTEM_BROADCAST");
    assert.equal(publicList[0].category, "COMMUNITY");
    assert.equal(publicList[0].priority, "NORMAL");

    const adminList = await broadcastService.getAdminBroadcasts(10);
    assert.equal(adminList.length, 1);
    assert.equal(adminList[0].content, "Old legacy announcement");
    assert.equal(adminList[0].category, "COMMUNITY");
    assert.equal(adminList[0].priority, "NORMAL");
  });

  // ─── 7. Contact Renaming Protection ───────────────────────────────────────

  test("23. Contact rename service rejects renaming system contacts (admin, broadcast, reviewer-bucket)", async () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";

    await assert.rejects(
      async () => {
        await privateContactService.setContactNickname(ownerId, "admin", "My Developer");
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /system contact cannot be renamed/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await privateContactService.setContactNickname(ownerId, "broadcast", "My Announcements");
      },
      (err: unknown) => {
        const error = err as AppError;
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /system contact cannot be renamed/i);
        return true;
      }
    );
  });

  // ─── 8. Dual Delivery Mode & Unread Tracking Tests ────────────────────────

  test("24. Dual delivery mode: ANNOUNCEMENT vs DIRECT_MESSAGE", async () => {
    const announcement = await broadcastService.createBroadcast({
      adminId: "admin",
      title: "Public Announcement",
      content: "Public notice",
      deliveryMode: "ANNOUNCEMENT"
    });
    assert.equal(announcement.deliveryMode, "ANNOUNCEMENT");

    const directMsg = await broadcastService.createBroadcast({
      adminId: "admin",
      title: "Direct Message",
      content: "Direct notice",
      deliveryMode: "DIRECT_MESSAGE"
    });
    assert.equal(directMsg.deliveryMode, "DIRECT_MESSAGE");

    // Public broadcasts only include ANNOUNCEMENT
    const userBroadcasts = await broadcastService.getUserBroadcasts(10);
    assert.equal(userBroadcasts.length, 1);
    assert.equal(userBroadcasts[0].content, "Public notice");
  });

  test("25. Unread tracking works accurately for broadcast announcements", async () => {
    const testUser = "77777777-7777-4777-8777-777777777777";

    await broadcastService.markAsRead(testUser);
    const count0 = await broadcastService.getUserUnreadCount(testUser);
    assert.equal(count0, 0);

    await broadcastService.createBroadcast({
      adminId: "admin",
      content: "Announcement 1",
      deliveryMode: "ANNOUNCEMENT"
    });
    await broadcastService.createBroadcast({
      adminId: "admin",
      content: "Announcement 2",
      deliveryMode: "ANNOUNCEMENT"
    });

    const count2 = await broadcastService.getUserUnreadCount(testUser);
    assert.equal(count2, 2);

    await broadcastService.markAsRead(testUser);
    const countReset = await broadcastService.getUserUnreadCount(testUser);
    assert.equal(countReset, 0);
  });
});
