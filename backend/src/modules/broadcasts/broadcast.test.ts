import { test, describe, before, after } from "node:test";
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
  createAdminBroadcast,
  getUserBroadcasts
} from "./broadcast.controller.js";
import { PrivateContactService } from "../private-contacts/private-contact.service.js";
import { PrivateRoomService } from "../private-rooms/private-room.service.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";

describe("Backend: Admin Broadcast Messaging Tests", () => {
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

  // ─── Broadcast Service & Persistence Tests ─────────────────────────────────

  test("1. Authenticated admin can create a broadcast (persisted with SYSTEM_BROADCAST and ALL_USERS)", async () => {
    const content = "We've added private messaging to Reviewer Bucket.";
    const broadcast = await broadcastService.createBroadcast("admin", content);

    assert.ok(broadcast.id);
    assert.equal(broadcast.content, content);
    assert.equal(broadcast.type, "SYSTEM_BROADCAST");
    assert.equal(broadcast.audience, "ALL_USERS");
    assert.equal(broadcast.adminId, "admin");

    // Verify exactly one document is in database
    const doc = await BroadcastModel.findById(broadcast.id);
    assert.ok(doc);
    assert.equal(doc.content, content);
    assert.equal(doc.type, "SYSTEM_BROADCAST");
    assert.equal(doc.audience, "ALL_USERS");
  });

  test("2. Validation rejects empty content", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast("admin", "");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /empty/i);
        return true;
      }
    );
  });

  test("3. Validation rejects whitespace-only content", async () => {
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast("admin", "    \n\t  ");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /empty/i);
        return true;
      }
    );
  });

  test("4. Validation rejects messages exceeding 2000 characters", async () => {
    const longContent = "A".repeat(2001);
    await assert.rejects(
      async () => {
        await broadcastService.createBroadcast("admin", longContent);
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /2000/i);
        return true;
      }
    );
  });

  // ─── User Sanitization & System Identity ───────────────────────────────────

  test("5. Public broadcast query returns sanitized official system identity (Reviewer Bucket)", async () => {
    const broadcasts = await broadcastService.getUserBroadcasts(10);
    assert.ok(broadcasts.length > 0);

    const first = broadcasts[0];
    assert.equal(first.senderName, "Reviewer Bucket");
    assert.equal(first.secondaryLabel, "Official announcement");
    assert.equal(first.type, "SYSTEM_BROADCAST");
    assert.equal(first.audience, "ALL_USERS");

    // Must NOT contain admin internal fields
    assert.equal((first as any).adminId, undefined);
    assert.equal((first as any).email, undefined);
    assert.equal((first as any).jwt, undefined);
  });

  // ─── Admin History & Retrieval ─────────────────────────────────────────────

  test("6. Admin can retrieve broadcast history", async () => {
    const adminBroadcasts = await broadcastService.getAdminBroadcasts(10);
    assert.ok(adminBroadcasts.length > 0);
    assert.equal(adminBroadcasts[0].type, "SYSTEM_BROADCAST");

    const single = await broadcastService.getAdminBroadcastById(adminBroadcasts[0].id);
    assert.equal(single.id, adminBroadcasts[0].id);
  });

  // ─── Controller & Middleware Tests ─────────────────────────────────────────

  test("7. requireAdminAuth rejects unauthenticated requests", () => {
    let nextError: any = null;
    const req = { headers: {} } as Request;
    const res = {} as Response;
    const next = (err?: any) => {
      nextError = err;
    };

    requireAdminAuth(req, res, next);
    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 401);
  });

  test("8. requireAdminAuth rejects non-admin users", () => {
    let nextError: any = null;
    const req = {
      headers: { authorization: `Bearer ${nonAdminToken}` }
    } as Request;
    const res = {} as Response;
    const next = (err?: any) => {
      nextError = err;
    };

    requireAdminAuth(req, res, next);
    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 403);
  });

  test("9. requireAdminAuth allows valid admin token", () => {
    let nextCalled = false;
    let nextError: any = null;
    const req = {
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as Request;
    const res = {} as Response;
    const next = (err?: any) => {
      nextCalled = true;
      nextError = err;
    };

    requireAdminAuth(req, res, next);
    assert.equal(nextCalled, true);
    assert.equal(nextError, undefined);
    assert.equal((req as any).admin?.role, "ADMIN");
  });

  test("10. createAdminBroadcast controller returns 201 with created broadcast", async () => {
    let statusCode = 0;
    let jsonResponse: any = null;

    const req = {
      admin: { sub: "admin", role: "ADMIN" },
      body: { content: "Official update announcement." }
    } as any;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonResponse = data;
        return this;
      }
    } as any;

    await createAdminBroadcast(req, res, () => {});

    assert.equal(statusCode, 201);
    assert.equal(jsonResponse.success, true);
    assert.equal(jsonResponse.broadcast.content, "Official update announcement.");
    assert.equal(jsonResponse.broadcast.type, "SYSTEM_BROADCAST");
  });

  test("11. getUserBroadcasts controller returns 200 with sanitized broadcasts for users", async () => {
    let statusCode = 0;
    let jsonResponse: any = null;

    const req = { query: { limit: "10" } } as any;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonResponse = data;
        return this;
      }
    } as any;

    await getUserBroadcasts(req, res, () => {});

    assert.equal(statusCode, 200);
    assert.equal(jsonResponse.success, true);
    assert.ok(Array.isArray(jsonResponse.broadcasts));
    assert.equal(jsonResponse.broadcasts[0].senderName, "Reviewer Bucket");
    assert.equal(jsonResponse.broadcasts[0].secondaryLabel, "Official announcement");
  });

  // ─── Contact Renaming Protection ───────────────────────────────────────────

  test("12. Contact rename service rejects renaming system contacts (admin, broadcast, reviewer-bucket)", async () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";

    await assert.rejects(
      async () => {
        await privateContactService.setContactNickname(ownerId, "admin", "My Developer");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /system contact cannot be renamed/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await privateContactService.setContactNickname(ownerId, "broadcast", "My Announcements");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /system contact cannot be renamed/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await privateContactService.setContactNickname(ownerId, "Reviewer Bucket", "Renamed System");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /system contact cannot be renamed/i);
        return true;
      }
    );
  });

  // ─── Dual-Mode Broadcast Tests: Announcement vs Direct Message ────────────

  test("13. Admin can send an official Announcement (deliveryMode: ANNOUNCEMENT) for public stream", async () => {
    const content = "We have launched Dark Mode across Reviewer Bucket!";
    const broadcast = await broadcastService.createBroadcast("admin", content, "ANNOUNCEMENT");

    assert.ok(broadcast.id);
    assert.equal(broadcast.deliveryMode, "ANNOUNCEMENT");

    const userBroadcasts = await broadcastService.getUserBroadcasts(10);
    assert.ok(userBroadcasts.length > 0);
    const found = userBroadcasts.find((b) => b.content === content);
    assert.ok(found);
    assert.equal(found.senderName, "Reviewer Bucket");
    assert.equal(found.secondaryLabel, "Official announcement");
  });

  test("14. Admin can send a Direct Message to all (deliveryMode: DIRECT_MESSAGE) into user Developer Chat", async () => {
    const testUser = "44444444-4444-4444-8444-444444444444";
    const privateRoomService = new PrivateRoomService();
    const privateMessageService = new PrivateMessageService();

    // Ensure active user developer room exists
    await privateRoomService.createOrGetDeveloperRoom(testUser);

    const msgContent = "hi bro";
    const broadcast = await broadcastService.createBroadcast("admin", msgContent, "DIRECT_MESSAGE");

    assert.ok(broadcast.id);
    assert.equal(broadcast.deliveryMode, "DIRECT_MESSAGE");

    // User fetches their developer room messages
    const room = await privateRoomService.createOrGetDeveloperRoom(testUser);
    const result = await privateMessageService.getMessages(room.id, testUser);

    assert.ok(result.messages.length > 0);
    const lastMsg = result.messages[result.messages.length - 1];
    assert.equal(lastMsg.content, msgContent);
    assert.equal(lastMsg.senderId, "admin");
  });

  test("15. User can reply to the received direct message and admin sees the reply in Private Chats", async () => {
    const testUser = "44444444-4444-4444-8444-444444444444";
    const privateRoomService = new PrivateRoomService();
    const privateMessageService = new PrivateMessageService();

    const room = await privateRoomService.createOrGetDeveloperRoom(testUser);

    // User sends a reply in that developer room
    const userReply = "thanks bro!";
    const replyMsg = await privateMessageService.sendMessage(room.id, testUser, userReply);

    assert.ok(replyMsg.id);
    assert.equal(replyMsg.content, userReply);
    assert.equal(replyMsg.senderId, testUser);

    // Admin fetches messages for this room
    const adminMessages = await privateMessageService.getAdminMessages(room.id);
    const lastAdminMsg = adminMessages.messages[adminMessages.messages.length - 1];
    assert.equal(lastAdminMsg.content, userReply);
    assert.equal(lastAdminMsg.senderId, testUser);
  });

  // ─── Broadcast Announcement Unread Tracking Tests ─────────────────────────

  test("16. getUserUnreadCount correctly calculates unread broadcast announcements for a user", async () => {
    const unreadTestUser = "55555555-5555-4555-8555-555555555555";

    // Mark as read initially
    await broadcastService.markAsRead(unreadTestUser);
    const initialCount = await broadcastService.getUserUnreadCount(unreadTestUser);
    assert.equal(initialCount, 0);

    // Create 2 new announcements
    await broadcastService.createBroadcast("admin", "New Announcement 1", "ANNOUNCEMENT");
    await broadcastService.createBroadcast("admin", "New Announcement 2", "ANNOUNCEMENT");

    const newCount = await broadcastService.getUserUnreadCount(unreadTestUser);
    assert.equal(newCount, 2);
  });

  test("17. markAsRead resets unread broadcast announcement count to 0", async () => {
    const unreadTestUser = "55555555-5555-4555-8555-555555555555";

    await broadcastService.markAsRead(unreadTestUser);
    const afterReadCount = await broadcastService.getUserUnreadCount(unreadTestUser);
    assert.equal(afterReadCount, 0);
  });
});
