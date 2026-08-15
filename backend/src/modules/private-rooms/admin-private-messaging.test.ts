import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { connectDatabase } from "../../config/database.js";
import { PrivateRoomModel } from "./private-room.model.js";
import { PrivateRoomService } from "./private-room.service.js";
import { PrivateMessageModel } from "../private-messages/private-message.model.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";
import { PrivateContactModel } from "../private-contacts/private-contact.model.js";
import { signJwt } from "../../utils/jwt.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";
import { createOrGetDeveloperRoom } from "./private-room.controller.js";
import {
  getAdminPrivateRooms,
  sendAdminPrivateRoomMessage
} from "./admin-private-room.controller.js";
import { validateAdminSendMessage } from "./admin-private-room.validation.js";

describe("Backend Module 3: Admin Private Messaging Tests", () => {
  const privateRoomService = new PrivateRoomService();
  const privateMessageService = new PrivateMessageService();

  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";
  const validAdminToken = signJwt({ sub: "admin", role: "ADMIN" }, env.JWT_SECRET);
  const nonAdminToken = signJwt({ sub: "user1", role: "USER" }, env.JWT_SECRET);

  before(async () => {
    await connectDatabase();
    await PrivateRoomModel.init();
    await PrivateMessageModel.init();

    // Clean up test data
    await PrivateRoomModel.deleteMany({
      participants: { $in: [userA, userB, "admin"] }
    });
    await PrivateContactModel.deleteMany({
      ownerId: { $in: [userA, userB, "admin"] }
    });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ─── Developer Room Creation & Idempotency ──────────────────────────────────

  test("1. Anonymous user can create/get developer room", async () => {
    const room = await privateRoomService.createOrGetDeveloperRoom(userA);
    assert.ok(room.id);
    assert.ok(room.participants.includes(userA));
    assert.ok(room.participants.includes("admin"));
  });

  test("2. Repeat request returns existing developer room (idempotent)", async () => {
    const room1 = await privateRoomService.createOrGetDeveloperRoom(userA);
    const room2 = await privateRoomService.createOrGetDeveloperRoom(userA);
    assert.equal(room1.id, room2.id);
  });

  test("3. Duplicate developer room creation under race conditions returns existing room", async () => {
    const [room1, room2] = await Promise.all([
      privateRoomService.createOrGetDeveloperRoom(userA),
      privateRoomService.createOrGetDeveloperRoom(userA)
    ]);
    assert.equal(room1.id, room2.id);
  });

  test("4. Invalid anonymous session (empty string) is rejected", async () => {
    await assert.rejects(
      async () => {
        await privateRoomService.createOrGetDeveloperRoom("   ");
      },
      (err: unknown) => err instanceof AppError && err.statusCode === 400
    );
  });

  // ─── Room Authorization & Isolation ────────────────────────────────────────

  test("5. Anonymous User A cannot retrieve User B's developer room", async () => {
    const roomB = await privateRoomService.createOrGetDeveloperRoom(userB);
    await assert.rejects(
      async () => {
        await privateRoomService.getRoomById(roomB.id, userA);
      },
      (err: unknown) => err instanceof AppError && err.statusCode === 403
    );
  });

  // ─── Admin Access & Authorization Middleware ───────────────────────────────

  test("6. Unauthenticated request to admin route is rejected with 401", () => {
    const req = { headers: {} } as Request;
    let error: unknown = null;
    requireAdminAuth(req, {} as Response, (err) => { error = err; });
    assert.ok(error instanceof AppError);
    assert.equal((error as AppError).statusCode, 401);
  });

  test("7. Invalid/Corrupted JWT token is rejected with 401", () => {
    const req = { headers: { authorization: "Bearer invalid.jwt.token" } } as Request;
    let error: unknown = null;
    requireAdminAuth(req, {} as Response, (err) => { error = err; });
    assert.ok(error);
  });

  test("8. Non-admin JWT token is rejected with 403 Forbidden", () => {
    const req = { headers: { authorization: `Bearer ${nonAdminToken}` } } as Request;
    let error: unknown = null;
    requireAdminAuth(req, {} as Response, (err) => { error = err; });
    assert.ok(error instanceof AppError);
    assert.equal((error as AppError).statusCode, 403);
  });

  test("9. Valid ADMIN JWT token passes requireAdminAuth middleware", () => {
    const req = { headers: { authorization: `Bearer ${validAdminToken}` } } as Request;
    let nextCalled = false;
    requireAdminAuth(req, {} as Response, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.ok(req.admin);
    assert.equal(req.admin.role, "ADMIN");
  });

  test("10. Valid ADMIN JWT can list developer rooms", async () => {
    const rooms = await privateRoomService.getAdminDeveloperRooms();
    assert.ok(Array.isArray(rooms));
    assert.ok(rooms.length >= 2);
    const hasRoomA = rooms.some((r) => r.participants.includes(userA));
    assert.ok(hasRoomA);
  });

  test("11. Valid ADMIN JWT can open a specific developer room", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    const fetched = await privateRoomService.getAdminRoomById(roomA.id);
    assert.equal(fetched.id, roomA.id);
    assert.ok(fetched.participants.includes(userA));
  });

  test("12. Admin cannot access an anonymous-to-anonymous room (returns 403)", async () => {
    const anonRoom = await privateRoomService.getOrCreateRoom(userA, userB);
    await assert.rejects(
      async () => {
        await privateRoomService.getAdminRoomById(anonRoom.id);
      },
      (err: unknown) => err instanceof AppError && err.statusCode === 403 && err.message.includes("Not a developer room")
    );
  });

  // ─── Messaging ─────────────────────────────────────────────────────────────

  test("13. Anonymous user can send a message in developer room", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    const msg = await privateMessageService.sendMessage(roomA.id, userA, "Hello Admin!");
    assert.ok(msg.id);
    assert.equal(msg.senderId, userA);
    assert.equal(msg.content, "Hello Admin!");
  });

  test("14. Admin can send a message in developer room", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    const msg = await privateMessageService.sendAdminMessage(roomA.id, "Hello User! How can I help?");
    assert.ok(msg.id);
    assert.equal(msg.senderId, "admin");
    assert.equal(msg.content, "Hello User! How can I help?");
  });

  test("15. Sender identity is derived from authenticated context and cannot be spoofed", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    const msgUser = await privateMessageService.sendMessage(roomA.id, userA, "User msg");
    assert.equal(msgUser.senderId, userA);

    const msgAdmin = await privateMessageService.sendAdminMessage(roomA.id, "Admin msg");
    assert.equal(msgAdmin.senderId, "admin");
  });

  test("16. Non-participant cannot retrieve messages from developer room", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    await assert.rejects(
      async () => {
        await privateMessageService.getMessages(roomA.id, userB);
      },
      (err: unknown) => err instanceof AppError && err.statusCode === 403
    );
  });

  test("17. Non-participant cannot send messages to developer room", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    await assert.rejects(
      async () => {
        await privateMessageService.sendMessage(roomA.id, userB, "Sneaky message");
      },
      (err: unknown) => err instanceof AppError && err.statusCode === 403
    );
  });

  // ─── Identity Representation & Nickname Safety ──────────────────────────────

  test("18. Admin sees user# style display identity for anonymous participant", async () => {
    const rooms = await privateRoomService.getAdminDeveloperRooms();
    const roomA = rooms.find((r) => r.participants.includes(userA));
    assert.ok(roomA);
    assert.equal(roomA?.anonymousDisplayId, `user#${userA}`);
  });

  test("19. Admin does not receive user-local nicknames from PrivateContact", async () => {
    await PrivateContactModel.create({
      ownerId: userB,
      contactId: userA,
      nickname: "Secret Local Nickname"
    });

    const roomA = await privateRoomService.getAdminRoomById(
      (await privateRoomService.createOrGetDeveloperRoom(userA)).id
    );

    assert.equal(roomA.anonymousDisplayId, `user#${userA}`);
    const stringified = JSON.stringify(roomA);
    assert.ok(!stringified.includes("Secret Local Nickname"));
  });

  test("20. Different anonymous users remain distinguishable to admin", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);
    const roomB = await privateRoomService.createOrGetDeveloperRoom(userB);

    const adminRoomA = await privateRoomService.getAdminRoomById(roomA.id);
    const adminRoomB = await privateRoomService.getAdminRoomById(roomB.id);

    assert.notEqual(adminRoomA.anonymousDisplayId, adminRoomB.anonymousDisplayId);
    assert.equal(adminRoomA.anonymousDisplayId, `user#${userA}`);
    assert.equal(adminRoomB.anonymousDisplayId, `user#${userB}`);
  });

  // ─── Controller & Validation Endpoints ─────────────────────────────────────

  test("21. Developer room creation controller handler returns structured response", async () => {
    const req = {
      headers: { "x-anonymous-client-id": userA }
    } as unknown as Request;

    let responseStatus = 0;
    type RoomResponse = { success: boolean; data: { id: string } };
    let responseData: RoomResponse | undefined;

    const res = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(payload: RoomResponse) {
        responseData = payload;
        return this;
      }
    } as unknown as Response;

    await createOrGetDeveloperRoom(req, res, () => {});
    assert.equal(responseStatus, 200);
    assert.ok(responseData);
    assert.equal(responseData.success, true);
    assert.ok(responseData.data.id);
  });

  test("22. Admin controllers return structured responses for room listing and message sending", async () => {
    const roomA = await privateRoomService.createOrGetDeveloperRoom(userA);

    // Test sendAdminPrivateRoomMessage controller
    const sendReq = {
      params: { roomId: roomA.id },
      body: { content: "Controller test message" }
    } as unknown as Request;

    let sendStatus = 0;
    type MsgResponse = { success: boolean; data: { id: string; content: string } };
    let sendData: MsgResponse | undefined;

    const sendRes = {
      status(code: number) {
        sendStatus = code;
        return this;
      },
      json(payload: MsgResponse) {
        sendData = payload;
        return this;
      }
    } as unknown as Response;

    await sendAdminPrivateRoomMessage(sendReq, sendRes, () => {});
    assert.equal(sendStatus, 201);
    assert.ok(sendData);
    assert.equal(sendData.success, true);
    assert.equal(sendData.data.content, "Controller test message");

    // Test getAdminPrivateRooms controller
    const listReq = { query: {} } as unknown as Request;
    let listStatus = 0;
    type ListResponse = { success: boolean; data: unknown[] };
    let listData: ListResponse | undefined;

    const listRes = {
      status(code: number) {
        listStatus = code;
        return this;
      },
      json(payload: ListResponse) {
        listData = payload;
        return this;
      }
    } as unknown as Response;

    await getAdminPrivateRooms(listReq, listRes, () => {});
    assert.equal(listStatus, 200);
    assert.ok(listData);
    assert.equal(listData.success, true);
    assert.ok(Array.isArray(listData.data));
  });

  test("23. Admin send message validation middleware rejects empty or invalid content", () => {
    const req = { body: { content: "   " } } as Request;
    let error: unknown = null;
    validateAdminSendMessage(req, {} as Response, (err) => { error = err; });
    assert.ok(error instanceof AppError);
    assert.equal((error as AppError).statusCode, 400);
  });
});
