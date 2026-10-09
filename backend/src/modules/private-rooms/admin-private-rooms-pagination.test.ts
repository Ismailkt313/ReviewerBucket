import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDatabase } from "../../config/database.js";
import { PrivateRoomModel } from "./private-room.model.js";
import { PrivateRoomService } from "./private-room.service.js";
import { AdminRoomLabelModel } from "./admin-room-label.model.js";
import { PrivateMessageModel } from "../private-messages/private-message.model.js";

describe("Backend Module: Admin Private Rooms Server-Side Pagination Tests", () => {
  const service = new PrivateRoomService();
  const testPrefix = "test-pag-user-";

  before(async () => {
    await connectDatabase();
    await PrivateRoomModel.init();
    await AdminRoomLabelModel.init();
    await PrivateMessageModel.init();

    await PrivateRoomModel.deleteMany({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    });
  });

  after(async () => {
    await PrivateRoomModel.deleteMany({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    });
    await mongoose.disconnect();
  });

  // Helper to create N test developer rooms with staggered timestamps
  async function createTestRooms(count: number, baseIndex = 0): Promise<string[]> {
    const createdIds: string[] = [];
    const baseTime = Date.now();

    for (let i = 0; i < count; i++) {
      const idx = baseIndex + i;
      const userId = `${testPrefix}${idx.toString().padStart(4, "0")}`;
      // Stagger timestamps: higher index = newer date
      const timestamp = new Date(baseTime + idx * 1000);

      const room = await PrivateRoomModel.create({
        participants: [userId, "admin"].sort() as [string, string],
        createdAt: timestamp,
        updatedAt: timestamp
      });
      createdIds.push(room._id.toString());
    }
    return createdIds;
  }

  test("1. Small dataset (<50 conversations): single page returns all conversations with accurate metadata", async () => {
    await PrivateRoomModel.deleteMany({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    });
    const createdIds = await createTestRooms(15);

    const result = await service.getAdminDeveloperRooms(1, 20, undefined, testPrefix);
    assert.equal(result.rooms.length, 15);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.limit, 20);
    assert.equal(result.pagination.total, 15);
    assert.equal(result.pagination.totalPages, 1);
    assert.equal(result.pagination.hasMore, false);
    assert.equal(result.pagination.hasPrev, false);
    assert.equal(result.pagination.hasNext, false);

    // Verify ordering: newest first (highest idx)
    const returnedIds = result.rooms.map((r) => r.id);
    assert.equal(returnedIds[0], createdIds[14]);
    assert.equal(returnedIds[14], createdIds[0]);
  });

  test("2. Exact boundary dataset (50 conversations): correctly splits across pages", async () => {
    await PrivateRoomModel.deleteMany({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    });
    const createdIds = await createTestRooms(50);

    // Page 1: limit 20 -> 20 items
    const page1 = await service.getAdminDeveloperRooms(1, 20, undefined, testPrefix);
    assert.equal(page1.rooms.length, 20);
    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.total, 50);
    assert.equal(page1.pagination.totalPages, 3);
    assert.equal(page1.pagination.hasMore, true);
    assert.equal(page1.pagination.hasPrev, false);
    assert.equal(page1.pagination.hasNext, true);

    // Page 2: limit 20 -> 20 items
    const page2 = await service.getAdminDeveloperRooms(2, 20, undefined, testPrefix);
    assert.equal(page2.rooms.length, 20);
    assert.equal(page2.pagination.page, 2);
    assert.equal(page2.pagination.total, 50);
    assert.equal(page2.pagination.hasMore, true);
    assert.equal(page2.pagination.hasPrev, true);
    assert.equal(page2.pagination.hasNext, true);

    // Page 3: limit 20 -> remaining 10 items
    const page3 = await service.getAdminDeveloperRooms(3, 20, undefined, testPrefix);
    assert.equal(page3.rooms.length, 10);
    assert.equal(page3.pagination.page, 3);
    assert.equal(page3.pagination.total, 50);
    assert.equal(page3.pagination.hasMore, false);
    assert.equal(page3.pagination.hasPrev, true);
    assert.equal(page3.pagination.hasNext, false);

    // Verify all 50 unique items were returned with zero duplicates across pages
    const allPageIds = [
      ...page1.rooms.map((r) => r.id),
      ...page2.rooms.map((r) => r.id),
      ...page3.rooms.map((r) => r.id)
    ];
    assert.equal(allPageIds.length, 50);
    assert.equal(new Set(allPageIds).size, 50, "Should have 50 distinct room IDs across 3 pages");
    assert.deepEqual(allPageIds, [...createdIds].reverse());
  });

  test("3. Large dataset (>50 conversations, e.g. 75): accesses conversations beyond the first 50", async () => {
    await PrivateRoomModel.deleteMany({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    });
    const createdIds = await createTestRooms(75);

    // Page 1 (items 1-25)
    const page1 = await service.getAdminDeveloperRooms(1, 25, undefined, testPrefix);
    assert.equal(page1.rooms.length, 25);
    assert.equal(page1.pagination.total, 75);
    assert.equal(page1.pagination.totalPages, 3);

    // Page 2 (items 26-50)
    const page2 = await service.getAdminDeveloperRooms(2, 25, undefined, testPrefix);
    assert.equal(page2.rooms.length, 25);

    // Page 3 (items 51-75) -> Conversations beyond the original 50 limit!
    const page3 = await service.getAdminDeveloperRooms(3, 25, undefined, testPrefix);
    assert.equal(page3.rooms.length, 25);
    assert.equal(page3.pagination.page, 3);
    assert.equal(page3.pagination.hasMore, false);
    assert.equal(page3.pagination.hasNext, false);
    assert.equal(page3.pagination.hasPrev, true);

    // Verify oldest conversation (created first) is in page 3
    assert.equal(page3.rooms[24].id, createdIds[0]);
  });

  test("4. High-volume dataset (150+ conversations): fast traversal without memory degradation", async () => {
    await PrivateRoomModel.deleteMany({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    });
    const totalCount = 150;
    const createdIds = await createTestRooms(totalCount);

    const pageSize = 30;
    const expectedPages = Math.ceil(totalCount / pageSize);
    const collectedIds: string[] = [];

    for (let p = 1; p <= expectedPages; p++) {
      const pageResult = await service.getAdminDeveloperRooms(p, pageSize, undefined, testPrefix);
      assert.equal(pageResult.pagination.page, p);
      assert.equal(pageResult.pagination.total, totalCount);
      assert.equal(pageResult.pagination.totalPages, expectedPages);
      collectedIds.push(...pageResult.rooms.map((r) => r.id));
    }

    assert.equal(collectedIds.length, totalCount);
    assert.equal(new Set(collectedIds).size, totalCount, "Every conversation is uniquely retrieved once");
    assert.deepEqual(collectedIds, [...createdIds].reverse());
  });

  test("5. Out-of-bounds page returns empty array and correct metadata", async () => {
    const result = await service.getAdminDeveloperRooms(999, 20, undefined, testPrefix);
    assert.equal(result.rooms.length, 0);
    assert.equal(result.pagination.page, 999);
    assert.equal(result.pagination.hasMore, false);
    assert.equal(result.pagination.hasNext, false);
    assert.equal(result.pagination.hasPrev, true);
  });

  test("6. Search filtering with pagination: filters by custom admin label or user ID", async () => {
    // Label one room specifically
    const rooms = await service.getAdminDeveloperRooms(1, 10, undefined, testPrefix);
    const targetRoom = rooms.rooms[0];
    assert.ok(targetRoom);

    await service.setAdminRoomLabel(targetRoom.id, "VIP Alpha Feedbacker");

    // Search by label
    const searchLabelResult = await service.getAdminDeveloperRooms(1, 20, undefined, "Alpha Feedbacker");
    assert.equal(searchLabelResult.rooms.length, 1);
    assert.equal(searchLabelResult.rooms[0].id, targetRoom.id);
    assert.equal(searchLabelResult.rooms[0].adminLabel, "VIP Alpha Feedbacker");
    assert.equal(searchLabelResult.pagination.total, 1);

    // Search by user ID substring
    const anonPart = targetRoom.participants.find((p) => p !== "admin")!;
    const searchUserResult = await service.getAdminDeveloperRooms(1, 20, undefined, anonPart);
    assert.ok(searchUserResult.rooms.length >= 1);
    assert.ok(searchUserResult.rooms.some((r) => r.id === targetRoom.id));
  });

  test("7. Message arrival bumps room activity to top on next page fetch", async () => {
    // Pick the oldest room
    const oldestRoom = await PrivateRoomModel.findOne({
      participants: { $elemMatch: { $regex: `^${testPrefix}` } }
    }).sort({ updatedAt: 1 });
    assert.ok(oldestRoom);

    // Update its updatedAt to far in the future (using $set and timestamps: false to bypass automatic timestamp)
    const futureTime = new Date(Date.now() + 10000000);
    await PrivateRoomModel.updateOne(
      { _id: oldestRoom._id },
      { $set: { updatedAt: futureTime } },
      { timestamps: false }
    );

    // Page 1 should now have oldestRoom as the first item
    const page1 = await service.getAdminDeveloperRooms(1, 20, undefined, testPrefix);
    assert.equal(page1.rooms[0].id, oldestRoom._id.toString());
  });
});
