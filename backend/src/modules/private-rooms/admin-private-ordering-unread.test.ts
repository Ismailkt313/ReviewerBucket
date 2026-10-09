import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDatabase } from "../../config/database.js";
import { PrivateRoomModel } from "./private-room.model.js";
import { PrivateRoomService } from "./private-room.service.js";
import { PrivateRoomReadStateModel } from "./private-room-read-state.model.js";
import { PrivateMessageModel } from "../private-messages/private-message.model.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";
import { AdminRoomLabelModel } from "./admin-room-label.model.js";

describe("Backend Integration: Latest Activity Ordering & Unread Conversations Test Suite", () => {
  const privateRoomService = new PrivateRoomService();
  const privateMessageService = new PrivateMessageService();
  const testPrefix = "test-ord-user-";

  const userA = `${testPrefix}alpha`;
  const userB = `${testPrefix}bravo`;
  const userC = `${testPrefix}charlie`;

  let roomAId: string;
  let roomBId: string;
  let roomCId: string;

  before(async () => {
    await connectDatabase();
    await PrivateRoomModel.init();
    await PrivateMessageModel.init();
    await PrivateRoomReadStateModel.init();
    await AdminRoomLabelModel.init();

    // Clean up isolated test data
    const existingRooms = await PrivateRoomModel.find({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    }).lean();
    const existingIds = existingRooms.map((r) => r._id);

    await PrivateRoomModel.deleteMany({ _id: { $in: existingIds } });
    await PrivateMessageModel.deleteMany({ roomId: { $in: existingIds } });
    await PrivateRoomReadStateModel.deleteMany({ roomId: { $in: existingIds } });

    // Create 3 test rooms with staggered initial timestamps
    const t0 = new Date("2026-01-01T10:00:00.000Z");
    const t1 = new Date("2026-01-01T10:05:00.000Z");
    const t2 = new Date("2026-01-01T10:10:00.000Z");

    const rA = await PrivateRoomModel.create({
      participants: [userA, "admin"].sort() as [string, string],
      createdAt: t0,
      updatedAt: t0
    });
    const rB = await PrivateRoomModel.create({
      participants: [userB, "admin"].sort() as [string, string],
      createdAt: t1,
      updatedAt: t1
    });
    const rC = await PrivateRoomModel.create({
      participants: [userC, "admin"].sort() as [string, string],
      createdAt: t2,
      updatedAt: t2
    });

    roomAId = rA._id.toString();
    roomBId = rB._id.toString();
    roomCId = rC._id.toString();

    // Reset admin read state
    await privateRoomService.markRoomAsRead(roomAId, "admin");
    await privateRoomService.markRoomAsRead(roomBId, "admin");
    await privateRoomService.markRoomAsRead(roomCId, "admin");
  });

  after(async () => {
    const existingRooms = await PrivateRoomModel.find({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    }).lean();
    const existingIds = existingRooms.map((r) => r._id);

    await PrivateRoomModel.deleteMany({ _id: { $in: existingIds } });
    await PrivateMessageModel.deleteMany({ roomId: { $in: existingIds } });
    await PrivateRoomReadStateModel.deleteMany({ roomId: { $in: existingIds } });

    await mongoose.disconnect();
  });

  test("1. Initial state: Rooms are ordered by latest activity descending (C > B > A)", async () => {
    const { rooms } = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    assert.equal(rooms.length, 3);
    assert.equal(rooms[0].id, roomCId);
    assert.equal(rooms[1].id, roomBId);
    assert.equal(rooms[2].id, roomAId);

    // Initial unread count is 0 for all
    assert.equal(rooms[0].unreadCount, 0);
    assert.equal(rooms[1].unreadCount, 0);
    assert.equal(rooms[2].unreadCount, 0);
  });

  test("2. Scenario 1: A new message arrives in oldest room A; it moves to the top of the list", async () => {
    const msg = await privateMessageService.sendMessage(roomAId, userA, "Hello admin, I need urgent help!");
    assert.ok(msg);

    const { rooms } = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    assert.equal(rooms.length, 3);
    // Room A must now be at index 0 (top)
    assert.equal(rooms[0].id, roomAId);
    assert.equal(rooms[1].id, roomCId);
    assert.equal(rooms[2].id, roomBId);

    // Room A's lastMessage must match the new message
    assert.equal(rooms[0].lastMessage?.content, "Hello admin, I need urgent help!");
    assert.equal(rooms[0].lastMessage?.senderId, userA);
  });

  test("3. Scenario 2: Unread conversation displays the correct unreadCount indicator", async () => {
    const { rooms } = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    const roomA = rooms.find((r) => r.id === roomAId);
    const roomB = rooms.find((r) => r.id === roomBId);
    const roomC = rooms.find((r) => r.id === roomCId);

    assert.ok(roomA);
    assert.ok(roomB);
    assert.ok(roomC);

    assert.equal(roomA.unreadCount, 1);
    assert.equal(roomB.unreadCount, 0);
    assert.equal(roomC.unreadCount, 0);

    const unreadData = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unreadData.rooms[roomAId], 1);
    assert.equal(unreadData.rooms[roomBId] || 0, 0);
    assert.equal(unreadData.rooms[roomCId] || 0, 0);
  });

  test("4. Scenario 5: Multiple incoming messages accumulate unread count correctly", async () => {
    await privateMessageService.sendMessage(roomAId, userA, "Second follow-up message");
    await privateMessageService.sendMessage(roomAId, userA, "Third follow-up message");

    const { rooms } = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    const roomA = rooms.find((r) => r.id === roomAId);
    assert.ok(roomA);
    assert.equal(roomA.unreadCount, 3);

    const unreadData = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unreadData.rooms[roomAId], 3);
  });

  test("5. Scenario 4: Messages sent by the admin do not incorrectly trigger incoming unread status", async () => {
    await privateMessageService.sendAdminMessage(roomAId, "Hello! I am reviewing your request now.");

    const { rooms } = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    const roomA = rooms.find((r) => r.id === roomAId);
    assert.ok(roomA);
    // Admin's own message marked the room as read for admin and does not increment unread
    assert.equal(roomA.unreadCount, 0);

    const unreadData = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unreadData.rooms[roomAId] || 0, 0);
  });

  test("6. Scenario 3: Reading a conversation updates its unread state correctly", async () => {
    // User B sends 2 messages
    await privateMessageService.sendMessage(roomBId, userB, "Question from user B");
    await privateMessageService.sendMessage(roomBId, userB, "Another question from user B");

    // Check that room B has 2 unread messages and is now top
    let res = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    assert.equal(res.rooms[0].id, roomBId);
    assert.equal(res.rooms[0].unreadCount, 2);

    // Admin opens/reads room B
    await privateRoomService.markRoomAsRead(roomBId, "admin");

    res = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    const roomB = res.rooms.find((r) => r.id === roomBId);
    assert.ok(roomB);
    assert.equal(roomB.unreadCount, 0);

    const unreadData = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unreadData.rooms[roomBId] || 0, 0);
  });

  test("7. Scenario 6: Pagination remains correct and stable across pages after conversations reorder", async () => {
    // Create additional staggered rooms to test multi-page sorting
    const extraUsers = ["extra-1", "extra-2", "extra-3", "extra-4"];
    const extraIds: string[] = [];

    for (let i = 0; i < extraUsers.length; i++) {
      const u = `${testPrefix}${extraUsers[i]}`;
      const d = new Date(`2026-01-01T09:0${i}:00.000Z`);
      const r = await PrivateRoomModel.create({
        participants: [u, "admin"].sort() as [string, string],
        createdAt: d,
        updatedAt: d
      });
      extraIds.push(r._id.toString());
      await privateRoomService.markRoomAsRead(r._id.toString(), "admin");
    }

    // Total rooms matching prefix = 3 + 4 = 7
    // Query with limit = 3 -> Page 1 has 3 items, Page 2 has 3 items, Page 3 has 1 item
    const page1 = await privateRoomService.getAdminDeveloperRooms(1, 3, undefined, testPrefix);
    assert.equal(page1.rooms.length, 3);
    assert.equal(page1.pagination.total, 7);
    assert.equal(page1.pagination.totalPages, 3);

    const page2 = await privateRoomService.getAdminDeveloperRooms(2, 3, undefined, testPrefix);
    assert.equal(page2.rooms.length, 3);

    const page3 = await privateRoomService.getAdminDeveloperRooms(3, 3, undefined, testPrefix);
    assert.equal(page3.rooms.length, 1);

    // Oldest conversation in extraIds[0] is currently on page 3
    const oldestId = extraIds[0];
    assert.equal(page3.rooms[0].id, oldestId);

    // Send message to oldest room
    await privateMessageService.sendMessage(oldestId, `${testPrefix}${extraUsers[0]}`, "I am back!");

    // Now page 1 must have oldestId at the top!
    const newPage1 = await privateRoomService.getAdminDeveloperRooms(1, 3, undefined, testPrefix);
    assert.equal(newPage1.rooms[0].id, oldestId);
    assert.equal(newPage1.rooms[0].unreadCount, 1);
  });

  test("8. Scenario 7 & 8: Database persistence preserves ordering and unread states across re-fetch / refresh", async () => {
    // Fresh independent query
    const freshQuery = await privateRoomService.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    assert.ok(freshQuery.rooms.length >= 7);

    // Verified sorted strictly descending by updatedAt
    for (let i = 0; i < freshQuery.rooms.length - 1; i++) {
      const currTime = new Date(freshQuery.rooms[i].updatedAt).getTime();
      const nextTime = new Date(freshQuery.rooms[i + 1].updatedAt).getTime();
      assert.ok(currTime >= nextTime, `Room ${i} updatedAt (${currTime}) should be >= Room ${i + 1} (${nextTime})`);
    }

    // Unread count is strictly maintained
    const unreadData = await privateRoomService.getAdminUnreadCounts();
    assert.ok(unreadData.totalUnreadCount >= 1);
  });
});
