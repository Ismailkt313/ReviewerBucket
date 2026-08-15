import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { Request, Response } from "express";
import { connectDatabase, disconnectDatabase } from "../../config/database.js";
import { PrivateRoomModel } from "./private-room.model.js";
import { PrivateRoomService } from "./private-room.service.js";
import { CommunityMessageModel } from "../community/community-message.model.js";
import { AppError } from "../../errors/app-error.js";
import {
  createOrGetPrivateRoom,
  getMyPrivateRooms,
  getPrivateRoomById
} from "./private-room.controller.js";
import {
  validateCreatePrivateRoom,
  validateGetPrivateRoomsQuery,
  validateRoomId
} from "./private-room.validation.js";

describe("Module 1: Private Room Tests", () => {
  const service = new PrivateRoomService();

  // Test anonymous client UUIDs
  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";
  const userC = "33333333-3333-4333-8333-333333333333";
  const nonExistentUser = "99999999-9999-4999-8999-999999999999";

  before(async () => {
    await connectDatabase();

    // Ensure indexes are built
    await PrivateRoomModel.init();

    // Clean up any test rooms
    await PrivateRoomModel.deleteMany({
      participants: { $in: [userA, userB, userC, nonExistentUser] }
    });

    // Clean up test community messages
    await CommunityMessageModel.deleteMany({
      anonymousClientId: { $in: [userA, userB, userC] }
    });

    // Seed test users in CommunityMessageModel to establish their presence
    await CommunityMessageModel.create([
      { content: "Hello from User A", color: "#123456", anonymousClientId: userA },
      { content: "Hello from User B", color: "#654321", anonymousClientId: userB },
      { content: "Hello from User C", color: "#abcdef", anonymousClientId: userC }
    ]);
  });

  after(async () => {
    // Cleanup created test data
    await PrivateRoomModel.deleteMany({
      participants: { $in: [userA, userB, userC, nonExistentUser] }
    });
    await CommunityMessageModel.deleteMany({
      anonymousClientId: { $in: [userA, userB, userC] }
    });
    await disconnectDatabase();
  });

  test("1. Create private room between User A and User B", async () => {
    const room = await service.getOrCreateRoom(userA, userB);
    assert.ok(room.id, "Room should have an id");
    assert.equal(room.participants.length, 2, "Room must have exactly 2 participants");
    assert.ok(room.participants.includes(userA), "Room must contain User A");
    assert.ok(room.participants.includes(userB), "Room must contain User B");
  });

  test("2. Creating A -> B again returns the existing room", async () => {
    const initialRoom = await service.getOrCreateRoom(userA, userB);
    const secondCall = await service.getOrCreateRoom(userA, userB);
    assert.equal(secondCall.id, initialRoom.id, "Second call must return the existing room ID");
  });

  test("3. Creating B -> A returns the same room (order independent)", async () => {
    const roomAB = await service.getOrCreateRoom(userA, userB);
    const roomBA = await service.getOrCreateRoom(userB, userA);
    assert.equal(roomBA.id, roomAB.id, "Reverse call must return the exact same room ID");
  });

  test("4. User A cannot create a room with User A (self-chat rejected)", async () => {
    await assert.rejects(
      async () => {
        await service.getOrCreateRoom(userA, userA);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 400);
        assert.match((err as AppError).message, /yourself/i);
        return true;
      }
    );
  });

  test("5. Invalid or non-existent target user is rejected", async () => {
    // Non-existent target user
    await assert.rejects(
      async () => {
        await service.getOrCreateRoom(userA, nonExistentUser);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 404);
        assert.match((err as AppError).message, /not exist/i);
        return true;
      }
    );
  });

  test("6. Non-participant cannot access a room (403 Forbidden)", async () => {
    const roomAB = await service.getOrCreateRoom(userA, userB);

    await assert.rejects(
      async () => {
        await service.getRoomById(roomAB.id, userC);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 403);
        assert.match((err as AppError).message, /not a participant/i);
        return true;
      }
    );
  });

  test("7. Participant User A and User B can access the room (200 OK)", async () => {
    const roomAB = await service.getOrCreateRoom(userA, userB);

    const roomForA = await service.getRoomById(roomAB.id, userA);
    assert.equal(roomForA.id, roomAB.id);

    const roomForB = await service.getRoomById(roomAB.id, userB);
    assert.equal(roomForB.id, roomAB.id);
  });

  test("8. Duplicate room creation is prevented under concurrent requests", async () => {
    // Clear test room between User A and User C
    await PrivateRoomModel.deleteMany({
      participants: { $all: [userA, userC] }
    });

    // Trigger concurrent creation from A->C and C->A simultaneously
    const [result1, result2, result3] = await Promise.all([
      service.getOrCreateRoom(userA, userC),
      service.getOrCreateRoom(userC, userA),
      service.getOrCreateRoom(userA, userC)
    ]);

    assert.equal(result1.id, result2.id, "Concurrent creations must resolve to the same room ID");
    assert.equal(result2.id, result3.id, "Concurrent creations must resolve to the same room ID");

    // Verify only 1 document exists in the database
    const sorted = [userA, userC].sort();
    const count = await PrivateRoomModel.countDocuments({
      "participants.0": sorted[0],
      "participants.1": sorted[1]
    });
    assert.equal(count, 1, "Exactly one room document should exist in MongoDB");
  });

  test("9. Getting current user's rooms returns only rooms where current user participates", async () => {
    const roomsForA = await service.getUserRooms(userA);
    assert.ok(roomsForA.length >= 2, "User A should participate in at least rooms (A-B and A-C)");
    for (const r of roomsForA) {
      assert.ok(r.participants.includes(userA), "Each returned room must contain User A");
    }

    const roomsForB = await service.getUserRooms(userB);
    assert.ok(roomsForB.length >= 1, "User B should participate in at least room (A-B)");
    for (const r of roomsForB) {
      assert.ok(r.participants.includes(userB), "Each returned room must contain User B");
    }
  });

  test("10. Validation middleware rejects missing client ID or invalid target user format", () => {
    // Missing anonymous client id
    const req1 = {
      headers: {},
      query: {},
      body: { targetUserId: userB }
    } as unknown as Request;
    let err1: unknown = null;
    validateCreatePrivateRoom(req1, {} as Response, (err) => { err1 = err; });
    assert.ok(err1 instanceof AppError);
    assert.equal((err1 as AppError).statusCode, 400);

    // Invalid target user UUID format
    const req2 = {
      headers: { "x-anonymous-client-id": userA },
      query: {},
      body: { targetUserId: "invalid-uuid" }
    } as unknown as Request;
    let err2: unknown = null;
    validateCreatePrivateRoom(req2, {} as Response, (err) => { err2 = err; });
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
      query: { limit: "invalid" }
    } as unknown as Request;
    let err4: unknown = null;
    validateGetPrivateRoomsQuery(req4, {} as Response, (err) => { err4 = err; });
    assert.ok(err4 instanceof AppError);
    assert.equal((err4 as AppError).statusCode, 400);
  });

  test("11. Controller handlers return structured responses", async () => {
    // Test createOrGetPrivateRoom controller handler
    const req = {
      headers: { "x-anonymous-client-id": userA },
      body: { targetUserId: userB }
    } as unknown as Request;

    let responseStatus = 0;
    type RoomResponsePayload = { success: boolean; data: { id: string; participants: string[] } };
    let responseData: RoomResponsePayload | undefined;

    const res = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(payload: RoomResponsePayload) {
        responseData = payload;
        return this;
      }
    } as unknown as Response;

    await createOrGetPrivateRoom(req, res, () => {});
    assert.equal(responseStatus, 200);
    assert.ok(responseData);
    assert.equal(responseData.success, true);
    assert.ok(responseData.data.id);

    // Test getMyPrivateRooms controller handler
    const listReq = {
      headers: { "x-anonymous-client-id": userA },
      query: {}
    } as unknown as Request;
    let listStatus = 0;
    type ListResponsePayload = { success: boolean; data: unknown[] };
    let listData: ListResponsePayload | undefined;
    const listRes = {
      status(code: number) {
        listStatus = code;
        return this;
      },
      json(payload: ListResponsePayload) {
        listData = payload;
        return this;
      }
    } as unknown as Response;

    await getMyPrivateRooms(listReq, listRes, () => {});
    assert.equal(listStatus, 200);
    assert.ok(listData);
    assert.equal(listData.success, true);
    assert.ok(Array.isArray(listData.data));

    // Test getPrivateRoomById controller handler
    const roomId = responseData.data.id;
    const getReq = {
      headers: { "x-anonymous-client-id": userA },
      params: { roomId }
    } as unknown as Request;
    let getStatus = 0;
    type SingleRoomResponsePayload = { success: boolean; data: { id: string } };
    let getRoomData: SingleRoomResponsePayload | undefined;
    const getRes = {
      status(code: number) {
        getStatus = code;
        return this;
      },
      json(payload: SingleRoomResponsePayload) {
        getRoomData = payload;
        return this;
      }
    } as unknown as Response;

    await getPrivateRoomById(getReq, getRes, () => {});
    assert.equal(getStatus, 200);
    assert.ok(getRoomData);
    assert.equal(getRoomData.success, true);
    assert.equal(getRoomData.data.id, roomId);
  });
});
