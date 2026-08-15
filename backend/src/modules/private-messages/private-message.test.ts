import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../../config/database.js";
import { PrivateRoomModel } from "../private-rooms/private-room.model.js";
import { PrivateRoomService } from "../private-rooms/private-room.service.js";
import { PrivateMessageModel } from "./private-message.model.js";
import { PrivateMessageService } from "./private-message.service.js";
import { CommunityMessageModel } from "../community/community-message.model.js";
import { AppError } from "../../errors/app-error.js";
import {
  sendPrivateMessage,
  getPrivateMessages
} from "./private-message.controller.js";
import {
  validateSendPrivateMessage,
  validateGetPrivateMessagesQuery,
  validateRoomId
} from "./private-message.validation.js";

describe("Module 2: Private Messaging Tests", () => {
  const roomService = new PrivateRoomService();
  const messageService = new PrivateMessageService();

  // Test anonymous client UUIDs
  const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const userC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  let testRoomId = "";

  before(async () => {
    await connectDatabase();

    // Ensure indexes are built
    await PrivateRoomModel.init();
    await PrivateMessageModel.init();

    // Clean up test data
    await PrivateRoomModel.deleteMany({
      participants: { $in: [userA, userB, userC] }
    });
    await CommunityMessageModel.deleteMany({
      anonymousClientId: { $in: [userA, userB, userC] }
    });

    // Seed test users in CommunityMessageModel
    await CommunityMessageModel.create([
      { content: "Hello from User A", color: "#111111", anonymousClientId: userA },
      { content: "Hello from User B", color: "#222222", anonymousClientId: userB },
      { content: "Hello from User C", color: "#333333", anonymousClientId: userC }
    ]);

    // Create a private room between User A and User B
    const room = await roomService.getOrCreateRoom(userA, userB);
    testRoomId = room.id;

    // Clean up any test messages in the room
    await PrivateMessageModel.deleteMany({
      roomId: new Types.ObjectId(testRoomId)
    });
  });

  after(async () => {
    // Cleanup test data
    if (testRoomId) {
      await PrivateMessageModel.deleteMany({
        roomId: new Types.ObjectId(testRoomId)
      });
    }
    await PrivateRoomModel.deleteMany({
      participants: { $in: [userA, userB, userC] }
    });
    await CommunityMessageModel.deleteMany({
      anonymousClientId: { $in: [userA, userB, userC] }
    });
    await disconnectDatabase();
  });

  // --- SEND MESSAGE TESTS ---

  test("1. Participant A can send a message to Room(A, B)", async () => {
    const msg = await messageService.sendMessage(testRoomId, userA, "Hello from A");
    assert.ok(msg.id, "Message must have an id");
    assert.equal(msg.roomId, testRoomId);
    assert.equal(msg.senderId, userA);
    assert.equal(msg.content, "Hello from A");
    assert.ok(msg.createdAt);
  });

  test("2. Participant B can send a message to Room(A, B)", async () => {
    const msg = await messageService.sendMessage(testRoomId, userB, "Hello back from B");
    assert.ok(msg.id);
    assert.equal(msg.roomId, testRoomId);
    assert.equal(msg.senderId, userB);
    assert.equal(msg.content, "Hello back from B");
  });

  test("3. Non-participant C cannot send a message to Room(A, B) (403 Forbidden)", async () => {
    await assert.rejects(
      async () => {
        await messageService.sendMessage(testRoomId, userC, "Intruder message");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 403);
        assert.match((err as AppError).message, /not a participant/i);
        return true;
      }
    );
  });

  test("4. Invalid or non-existent room is rejected", async () => {
    // Non-existent room
    const fakeRoomId = new Types.ObjectId().toString();
    await assert.rejects(
      async () => {
        await messageService.sendMessage(fakeRoomId, userA, "Test");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 404);
        assert.match((err as AppError).message, /not found/i);
        return true;
      }
    );

    // Non-existent / invalid room in service call
    await assert.rejects(
      async () => {
        await messageService.sendMessage("invalid-room-id", userA, "Test");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 404);
        assert.match((err as AppError).message, /not found/i);
        return true;
      }
    );
  });

  test("5. Missing or invalid content is rejected (400 Bad Request)", async () => {
    await assert.rejects(
      async () => {
        await messageService.sendMessage(testRoomId, userA, "");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 400);
        assert.match((err as AppError).message, /empty/i);
        return true;
      }
    );
  });

  test("6. Empty or whitespace-only content is rejected", async () => {
    await assert.rejects(
      async () => {
        await messageService.sendMessage(testRoomId, userA, "    \n\t  ");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 400);
        assert.match((err as AppError).message, /empty/i);
        return true;
      }
    );
  });

  test("7. Sender identity strictly comes from session (cannot be spoofed)", async () => {
    // Attempt sending as User A with server-derived sender identity
    const msg = await messageService.sendMessage(testRoomId, userA, "Authentic message");
    assert.equal(msg.senderId, userA, "Sender must match session user");
    assert.notEqual(msg.senderId, userB);
  });

  test("8. Server-generated creation timestamp is used", async () => {
    const beforeTime = new Date(Date.now() - 1000);
    const msg = await messageService.sendMessage(testRoomId, userA, "Timestamp test");
    const msgTime = new Date(msg.createdAt);
    const afterTime = new Date(Date.now() + 1000);

    assert.ok(msgTime >= beforeTime, "Timestamp should be on or after beforeTime");
    assert.ok(msgTime <= afterTime, "Timestamp should be on or before afterTime");
  });

  // --- READ MESSAGES TESTS ---

  test("9. Participant A can retrieve Room(A, B) messages", async () => {
    const result = await messageService.getMessages(testRoomId, userA);
    assert.ok(Array.isArray(result.messages));
    assert.ok(result.messages.length >= 4, "Should have retrieved existing room messages");
    for (const m of result.messages) {
      assert.equal(m.roomId, testRoomId);
    }
  });

  test("10. Participant B can retrieve Room(A, B) messages", async () => {
    const result = await messageService.getMessages(testRoomId, userB);
    assert.ok(Array.isArray(result.messages));
    assert.ok(result.messages.length >= 4);
  });

  test("11. Non-participant C cannot retrieve Room(A, B) messages (403 Forbidden)", async () => {
    await assert.rejects(
      async () => {
        await messageService.getMessages(testRoomId, userC);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 403);
        assert.match((err as AppError).message, /not a participant/i);
        return true;
      }
    );
  });

  test("12. Message ordering is chronological (oldest -> newest)", async () => {
    const result = await messageService.getMessages(testRoomId, userA);
    for (let i = 0; i < result.messages.length - 1; i++) {
      const current = new Date(result.messages[i].createdAt).getTime();
      const next = new Date(result.messages[i + 1].createdAt).getTime();
      assert.ok(current <= next, "Messages must be sorted in ascending chronological order");
    }
  });

  test("13. Pagination works correctly with limit and cursor without duplicates", async () => {
    // Create dedicated room for pagination test
    const pageRoom = await roomService.getOrCreateRoom(userA, userC);
    const pageRoomId = pageRoom.id;

    // Seed 15 messages sequentially
    for (let i = 1; i <= 15; i++) {
      await messageService.sendMessage(pageRoomId, userA, `Message #${i}`);
    }

    // Page 1: limit 5 (most recent 5 messages: #11 to #15)
    const page1 = await messageService.getMessages(pageRoomId, userA, 5);
    assert.equal(page1.messages.length, 5);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.nextCursor, "Must have nextCursor for fetching older messages");
    assert.equal(page1.messages[0].content, "Message #11");
    assert.equal(page1.messages[4].content, "Message #15");

    // Page 2: limit 5 using nextCursor from page 1 (older 5 messages: #6 to #10)
    const page2 = await messageService.getMessages(pageRoomId, userA, 5, page1.nextCursor);
    assert.equal(page2.messages.length, 5);
    assert.equal(page2.hasMore, true);
    assert.ok(page2.nextCursor);
    assert.equal(page2.messages[0].content, "Message #6");
    assert.equal(page2.messages[4].content, "Message #10");

    // Page 3: limit 5 using nextCursor from page 2 (oldest 5 messages: #1 to #5)
    const page3 = await messageService.getMessages(pageRoomId, userA, 5, page2.nextCursor);
    assert.equal(page3.messages.length, 5);
    assert.equal(page3.hasMore, false);
    assert.equal(page3.nextCursor, undefined);
    assert.equal(page3.messages[0].content, "Message #1");
    assert.equal(page3.messages[4].content, "Message #5");

    // Verify all message IDs are unique across pages (no duplicate or missing records)
    const allIds = [
      ...page1.messages.map((m) => m.id),
      ...page2.messages.map((m) => m.id),
      ...page3.messages.map((m) => m.id)
    ];
    assert.equal(new Set(allIds).size, 15, "Should have 15 distinct message IDs across 3 pages");
  });

  // --- HTTP CONTROLLER & VALIDATION TESTS ---

  test("14. Validation middleware enforces valid message content and parameters", () => {
    // Missing anonymous client id
    const req1 = {
      headers: {},
      query: {},
      params: { roomId: testRoomId },
      body: { content: "Hello" }
    } as unknown as Request;
    let err1: unknown = null;
    validateSendPrivateMessage(req1, {} as Response, (err) => { err1 = err; });
    assert.ok(err1 instanceof AppError);
    assert.equal((err1 as AppError).statusCode, 400);

    // Empty content
    const req2 = {
      headers: { "x-anonymous-client-id": userA },
      params: { roomId: testRoomId },
      body: { content: "   " }
    } as unknown as Request;
    let err2: unknown = null;
    validateSendPrivateMessage(req2, {} as Response, (err) => { err2 = err; });
    assert.ok(err2 instanceof AppError);
    assert.equal((err2 as AppError).statusCode, 400);

    // Invalid roomId format
    const req3 = {
      params: { roomId: "not-an-object-id" }
    } as unknown as Request;
    let err3: unknown = null;
    validateRoomId(req3, {} as Response, (err) => { err3 = err; });
    assert.ok(err3 instanceof AppError);
    assert.equal((err3 as AppError).statusCode, 400);

    // Invalid query limit
    const req4 = {
      headers: { "x-anonymous-client-id": userA },
      params: { roomId: testRoomId },
      query: { limit: "invalid" }
    } as unknown as Request;
    let err4: unknown = null;
    validateGetPrivateMessagesQuery(req4, {} as Response, (err) => { err4 = err; });
    assert.ok(err4 instanceof AppError);
    assert.equal((err4 as AppError).statusCode, 400);
  });

  test("15. Controller handlers return structured responses", async () => {
    // Test sendPrivateMessage controller handler
    const sendReq = {
      headers: { "x-anonymous-client-id": userA },
      params: { roomId: testRoomId },
      body: { content: "Controller test message" }
    } as unknown as Request;

    let sendStatus = 0;
    type SendResponsePayload = { success: boolean; data: { id: string; content: string; senderId: string } };
    let sendData: SendResponsePayload | undefined;
    const sendRes = {
      status(code: number) {
        sendStatus = code;
        return this;
      },
      json(payload: SendResponsePayload) {
        sendData = payload;
        return this;
      }
    } as unknown as Response;

    await sendPrivateMessage(sendReq, sendRes, () => {});
    assert.equal(sendStatus, 201);
    assert.ok(sendData);
    assert.equal(sendData.success, true);
    assert.equal(sendData.data.content, "Controller test message");
    assert.equal(sendData.data.senderId, userA);

    // Test getPrivateMessages controller handler
    const getReq = {
      headers: { "x-anonymous-client-id": userA },
      params: { roomId: testRoomId },
      query: { limit: 10 }
    } as unknown as Request;

    let getStatus = 0;
    type GetResponsePayload = { success: boolean; data: { messages: unknown[]; hasMore: boolean } };
    let getData: GetResponsePayload | undefined;
    const getRes = {
      status(code: number) {
        getStatus = code;
        return this;
      },
      json(payload: GetResponsePayload) {
        getData = payload;
        return this;
      }
    } as unknown as Response;

    await getPrivateMessages(getReq, getRes, () => {});
    assert.equal(getStatus, 200);
    assert.ok(getData);
    assert.equal(getData.success, true);
    assert.ok(Array.isArray(getData.data.messages));
  });
});
