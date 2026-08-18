import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDatabase } from "../../config/database.js";
import { PrivateRoomModel } from "./private-room.model.js";
import { PrivateRoomService } from "./private-room.service.js";
import { PrivateRoomReadStateModel } from "./private-room-read-state.model.js";
import { PrivateMessageModel } from "../private-messages/private-message.model.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";
import { BroadcastModel } from "../broadcasts/broadcast.model.js";
import { BroadcastService } from "../broadcasts/broadcast.service.js";
import { CommunityMessageModel } from "../community/community-message.model.js";

describe("Backend Module: Admin Private Chat Unread Message System Tests", () => {
  const privateRoomService = new PrivateRoomService();
  const privateMessageService = new PrivateMessageService();
  const broadcastService = new BroadcastService();

  const user1 = "99991111-9999-4111-8111-999911119999";
  const user2 = "99992222-9999-4222-8222-999922229999";

  let room1Id: string;
  let room2Id: string;

  before(async () => {
    await connectDatabase();
    await PrivateRoomModel.init();
    await PrivateMessageModel.init();
    await PrivateRoomReadStateModel.init();
    await BroadcastModel.init();
    await CommunityMessageModel.init();

    // Clean up isolated test data
    const existingRooms = await PrivateRoomModel.find({
      participants: { $in: [user1, user2] }
    }).lean();
    const existingRoomIds = existingRooms.map((r) => r._id);

    await PrivateRoomModel.deleteMany({ _id: { $in: existingRoomIds } });
    await PrivateMessageModel.deleteMany({ roomId: { $in: existingRoomIds } });
    await PrivateRoomReadStateModel.deleteMany({ roomId: { $in: existingRoomIds } });

    // Setup 2 developer rooms
    const r1 = await privateRoomService.createOrGetDeveloperRoom(user1);
    const r2 = await privateRoomService.createOrGetDeveloperRoom(user2);
    room1Id = r1.id;
    room2Id = r2.id;

    // Reset admin read state for both rooms
    await privateRoomService.markRoomAsRead(room1Id, "admin");
    await privateRoomService.markRoomAsRead(room2Id, "admin");
  });

  after(async () => {
    const existingRooms = await PrivateRoomModel.find({
      participants: { $in: [user1, user2] }
    }).lean();
    const existingRoomIds = existingRooms.map((r) => r._id);

    await PrivateRoomModel.deleteMany({ _id: { $in: existingRoomIds } });
    await PrivateMessageModel.deleteMany({ roomId: { $in: existingRoomIds } });
    await PrivateRoomReadStateModel.deleteMany({ roomId: { $in: existingRoomIds } });

    await mongoose.disconnect();
  });

  test("1. Initial state: Admin has 0 unread messages in test rooms", async () => {
    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("2. New user message creates unread state for admin", async () => {
    await privateMessageService.sendMessage(room1Id, user1, "Hello Developer!");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id], 1);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("3. Multiple user messages in same room accumulate unread count", async () => {
    await privateMessageService.sendMessage(room1Id, user1, "I found another issue.");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id], 2);
  });

  test("4. User 2 sending a message creates unread in second room", async () => {
    await privateMessageService.sendMessage(room2Id, user2, "Can you help me?");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id], 2);
    assert.equal(unread.rooms[room2Id], 1);
  });

  test("5. Admin developer rooms listing includes accurate unreadCount per room", async () => {
    const rooms = await privateRoomService.getAdminDeveloperRooms();
    const r1 = rooms.find((r) => r.id === room1Id);
    const r2 = rooms.find((r) => r.id === room2Id);

    assert.ok(r1);
    assert.ok(r2);
    assert.equal(r1.unreadCount, 2);
    assert.equal(r2.unreadCount, 1);
  });

  test("6. Admin opening room 1 (markRoomAsRead) resets room 1 unread to 0", async () => {
    await privateRoomService.markRoomAsRead(room1Id, "admin");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id], 1);
  });

  test("7. Admin's own message / reply does NOT create unread for admin", async () => {
    await privateMessageService.sendAdminMessage(room1Id, "Thanks, I will investigate this!");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id], 1);
  });

  test("8. Admin opening room 2 resets room 2 unread to 0", async () => {
    await privateRoomService.markRoomAsRead(room2Id, "admin");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("9. System Broadcast / Announcement does NOT create admin unread state", async () => {
    await broadcastService.createBroadcast({
      adminId: "admin",
      content: "System Maintenance Scheduled",
      deliveryMode: "ANNOUNCEMENT"
    });

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("10. Personal Message Broadcast does NOT create admin unread state", async () => {
    await broadcastService.createBroadcast({
      adminId: "admin",
      content: "Direct notice to all users",
      deliveryMode: "DIRECT_MESSAGE"
    });

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("11. Community Chat message does NOT create private chat admin unread state", async () => {
    await CommunityMessageModel.create({
      anonymousClientId: user1,
      content: "Hello community!"
    });

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("12. User replying after broadcast creates unread ONLY in that specific user room", async () => {
    await privateMessageService.sendMessage(room1Id, user1, "Got your broadcast!");

    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id], 1);
    assert.equal(unread.rooms[room2Id] || 0, 0);
  });

  test("13. Read state persists in database (survives reconnect/refresh simulation)", async () => {
    const readDoc = await PrivateRoomReadStateModel.findOne({
      clientId: "admin",
      roomId: new mongoose.Types.ObjectId(room1Id)
    });
    assert.ok(readDoc);
    assert.ok(readDoc.lastReadAt);

    const freshQuery = await privateRoomService.getAdminUnreadCounts();
    assert.equal(freshQuery.rooms[room1Id], 1);
  });

  test("14. Marking room 1 as read clears remaining unread state", async () => {
    await privateRoomService.markRoomAsRead(room1Id, "admin");
    const unread = await privateRoomService.getAdminUnreadCounts();
    assert.equal(unread.rooms[room1Id] || 0, 0);
  });
});
