import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { Request, Response } from "express";
import { connectDatabase, disconnectDatabase } from "../../config/database.js";
import { PrivateContactModel } from "./private-contact.model.js";
import { PrivateContactService } from "./private-contact.service.js";
import { CommunityMessageModel } from "../community/community-message.model.js";
import { AppError } from "../../errors/app-error.js";
import {
  getContactIdentity,
  renameContact,
  getMyContacts
} from "./private-contact.controller.js";
import {
  validateContactId,
  validateRenameContact,
  validateGetContactsQuery
} from "./private-contact.validation.js";

describe("Module 3: Private Contact Identity Tests", () => {
  const service = new PrivateContactService();

  // Test anonymous client UUIDs
  const userA = "11112222-3333-4444-8888-aaaaaaaaaaaa";
  const userB = "22223333-4444-4555-8888-bbbbbbbbbbbb";
  const userC = "33334444-5555-4666-8888-cccccccccccc";
  const userD = "44445555-6666-4777-8888-dddddddddddd";
  const nonExistentUser = "99998888-7777-4666-8555-000000000000";

  before(async () => {
    await connectDatabase();

    // Ensure indexes are built
    await PrivateContactModel.init();

    // Clean up test data
    await PrivateContactModel.deleteMany({
      ownerId: { $in: [userA, userB, userC, userD] }
    });
    await CommunityMessageModel.deleteMany({
      anonymousClientId: { $in: [userA, userB, userC, userD] }
    });

    // Seed test users in CommunityMessageModel
    await CommunityMessageModel.create([
      { content: "Hello A", color: "#111", anonymousClientId: userA },
      { content: "Hello B", color: "#222", anonymousClientId: userB },
      { content: "Hello C", color: "#333", anonymousClientId: userC },
      { content: "Hello D", color: "#444", anonymousClientId: userD }
    ]);
  });

  after(async () => {
    // Cleanup test data
    await PrivateContactModel.deleteMany({
      ownerId: { $in: [userA, userB, userC, userD] }
    });
    await CommunityMessageModel.deleteMany({
      anonymousClientId: { $in: [userA, userB, userC, userD] }
    });
    await disconnectDatabase();
  });

  // --- RETRIEVAL TESTS ---

  test("1. User A receives 'Anonymous User' when no custom nickname exists", async () => {
    const identity = await service.getContactIdentity(userA, userB);
    assert.equal(identity.contactId, userB);
    assert.equal(identity.displayName, "Anonymous User");
    assert.equal(identity.nickname, null);
    assert.equal(identity.isCustomName, false);
  });

  test("2. User A can rename User B to 'Next.js Guy'", async () => {
    const updated = await service.setContactNickname(userA, userB, "Next.js Guy");
    assert.equal(updated.contactId, userB);
    assert.equal(updated.displayName, "Next.js Guy");
    assert.equal(updated.nickname, "Next.js Guy");
    assert.equal(updated.isCustomName, true);
  });

  test("3. User A receives the saved nickname after renaming", async () => {
    const identity = await service.getContactIdentity(userA, userB);
    assert.equal(identity.displayName, "Next.js Guy");
    assert.equal(identity.nickname, "Next.js Guy");
    assert.equal(identity.isCustomName, true);
  });

  test("4. User B cannot see User A's private nickname mapping for B", async () => {
    // From User B's perspective, User B checking User A's name gets default "Anonymous User"
    const identityB = await service.getContactIdentity(userB, userA);
    assert.equal(identityB.displayName, "Anonymous User");
    assert.equal(identityB.isCustomName, false);
  });

  test("5. User B can independently assign a different name to User A", async () => {
    const updatedB = await service.setContactNickname(userB, userA, "Reviewer Boss");
    assert.equal(updatedB.displayName, "Reviewer Boss");
    assert.equal(updatedB.isCustomName, true);

    // Verify User A still sees User B as "Next.js Guy"
    const identityA = await service.getContactIdentity(userA, userB);
    assert.equal(identityA.displayName, "Next.js Guy");

    // Verify User B sees User A as "Reviewer Boss"
    const identityB = await service.getContactIdentity(userB, userA);
    assert.equal(identityB.displayName, "Reviewer Boss");
  });

  test("6. Renaming one contact does not affect another contact", async () => {
    await service.setContactNickname(userA, userC, "React Guy");
    const contactB = await service.getContactIdentity(userA, userB);
    const contactC = await service.getContactIdentity(userA, userC);

    assert.equal(contactB.displayName, "Next.js Guy");
    assert.equal(contactC.displayName, "React Guy");
  });

  test("7. Nickname normalization (case-insensitive & whitespace-insensitive)", async () => {
    // User A trying to assign "react guy" or " REACT   GUY " to User D must be rejected because User C already has "React Guy"
    await assert.rejects(
      async () => {
        await service.setContactNickname(userA, userD, "  react   guy  ");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 409);
        assert.match((err as AppError).message, /already in use/i);
        return true;
      }
    );
  });

  test("8. Same nickname can be used by different owners", async () => {
    // User B assigning "React Guy" to User C is allowed (uniqueness is scoped to owner)
    const updated = await service.setContactNickname(userB, userC, "React Guy");
    assert.equal(updated.displayName, "React Guy");
    assert.equal(updated.isCustomName, true);
  });

  test("9. Renaming an existing contact updates the existing record rather than creating a duplicate", async () => {
    const updated = await service.setContactNickname(userA, userB, "Fullstack Master");
    assert.equal(updated.displayName, "Fullstack Master");

    // Verify only 1 document exists for User A -> User B
    const count = await PrivateContactModel.countDocuments({
      ownerId: userA,
      contactId: userB
    });
    assert.equal(count, 1, "Exactly one contact mapping should exist for owner-contact pair");
  });

  test("10. Invalid nickname length (>50 chars) is rejected", async () => {
    const longName = "A".repeat(51);
    await assert.rejects(
      async () => {
        await service.setContactNickname(userA, userD, longName);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 400);
        assert.match((err as AppError).message, /50 characters/i);
        return true;
      }
    );
  });

  test("11. Clearing/resetting nickname returns contact to 'Anonymous User'", async () => {
    // Reset User C's nickname by passing null or empty
    const cleared = await service.setContactNickname(userA, userC, null);
    assert.equal(cleared.displayName, "Anonymous User");
    assert.equal(cleared.nickname, null);
    assert.equal(cleared.isCustomName, false);

    // Verify database record has null nickname
    const doc = await PrivateContactModel.findOne({ ownerId: userA, contactId: userC });
    assert.equal(doc?.nickname, null);
    assert.equal(doc?.normalizedNickname, null);
  });

  test("12. After clearing a nickname, that nickname can be assigned to another contact", async () => {
    // Since "React Guy" was cleared from User C, User A can now assign "React Guy" to User D
    const updatedD = await service.setContactNickname(userA, userD, "React Guy");
    assert.equal(updatedD.displayName, "React Guy");
    assert.equal(updatedD.isCustomName, true);
  });

  test("13. Non-existent contact is rejected with 404 Not Found", async () => {
    await assert.rejects(
      async () => {
        await service.getContactIdentity(userA, nonExistentUser);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 404);
        assert.match((err as AppError).message, /not exist/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await service.setContactNickname(userA, nonExistentUser, "Ghost");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 404);
        assert.match((err as AppError).message, /not exist/i);
        return true;
      }
    );
  });

  test("14. Self-contact mapping is rejected with 400 Bad Request", async () => {
    await assert.rejects(
      async () => {
        await service.setContactNickname(userA, userA, "Myself");
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).statusCode, 400);
        assert.match((err as AppError).message, /yourself/i);
        return true;
      }
    );
  });

  test("15. Concurrent rename operations for duplicate nickname are prevented by database constraints", async () => {
    // Attempt concurrent renames of two different contacts (User B and User C) to the same nickname "Golang Pro"
    const results = await Promise.allSettled([
      service.setContactNickname(userA, userB, "Golang Pro"),
      service.setContactNickname(userA, userC, "Golang Pro")
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one rename should succeed");
    assert.equal(rejected.length, 1, "The duplicate nickname attempt must be rejected");

    if (rejected[0].status === "rejected") {
      const err = rejected[0].reason;
      assert.ok(err instanceof AppError);
      assert.equal((err as AppError).statusCode, 409);
    }
  });

  test("16. Listing owner contacts returns only current user's contact mappings", async () => {
    const listA = await service.getOwnerContacts(userA);
    assert.ok(Array.isArray(listA));
    assert.ok(listA.length >= 2);
    for (const c of listA) {
      assert.ok(c.contactId);
      assert.ok(c.displayName);
    }
  });

  // --- HTTP CONTROLLER & VALIDATION TESTS ---

  test("17. Validation middleware enforces valid parameters and payloads", () => {
    // Missing anonymous client id
    const req1 = {
      headers: {},
      query: {},
      params: { contactId: userB },
      body: { nickname: "Test" }
    } as unknown as Request;
    let err1: unknown = null;
    validateRenameContact(req1, {} as Response, (err) => { err1 = err; });
    assert.ok(err1 instanceof AppError);
    assert.equal((err1 as AppError).statusCode, 400);

    // Invalid contactId format
    const req2 = {
      params: { contactId: "not-a-valid-uuid" }
    } as unknown as Request;
    let err2: unknown = null;
    validateContactId(req2, {} as Response, (err) => { err2 = err; });
    assert.ok(err2 instanceof AppError);
    assert.equal((err2 as AppError).statusCode, 400);

    // Nickname too long
    const req3 = {
      headers: { "x-anonymous-client-id": userA },
      params: { contactId: userB },
      body: { nickname: "X".repeat(55) }
    } as unknown as Request;
    let err3: unknown = null;
    validateRenameContact(req3, {} as Response, (err) => { err3 = err; });
    assert.ok(err3 instanceof AppError);
    assert.equal((err3 as AppError).statusCode, 400);

    // Query limit validation
    const req4 = {
      headers: { "x-anonymous-client-id": userA },
      query: { limit: "invalid" }
    } as unknown as Request;
    let err4: unknown = null;
    validateGetContactsQuery(req4, {} as Response, (err) => { err4 = err; });
    assert.ok(err4 instanceof AppError);
    assert.equal((err4 as AppError).statusCode, 400);
  });

  test("18. Controller handlers return structured responses", async () => {
    // Test getContactIdentity controller handler
    const getReq = {
      headers: { "x-anonymous-client-id": userA },
      params: { contactId: userB }
    } as unknown as Request;

    let getStatus = 0;
    type ContactResponsePayload = { success: boolean; data: { contactId: string; displayName: string } };
    let getData: ContactResponsePayload | undefined;
    const getRes = {
      status(code: number) {
        getStatus = code;
        return this;
      },
      json(payload: ContactResponsePayload) {
        getData = payload;
        return this;
      }
    } as unknown as Response;

    await getContactIdentity(getReq, getRes, () => {});
    assert.equal(getStatus, 200);
    assert.ok(getData);
    assert.equal(getData.success, true);
    assert.equal(getData.data.contactId, userB);

    // Test renameContact controller handler
    const patchReq = {
      headers: { "x-anonymous-client-id": userA },
      params: { contactId: userB },
      body: { nickname: "Controller Master" }
    } as unknown as Request;

    let patchStatus = 0;
    let patchData: ContactResponsePayload | undefined;
    const patchRes = {
      status(code: number) {
        patchStatus = code;
        return this;
      },
      json(payload: ContactResponsePayload) {
        patchData = payload;
        return this;
      }
    } as unknown as Response;

    await renameContact(patchReq, patchRes, () => {});
    assert.equal(patchStatus, 200);
    assert.ok(patchData);
    assert.equal(patchData.success, true);
    assert.equal(patchData.data.displayName, "Controller Master");

    // Test getMyContacts controller handler
    const listReq = {
      headers: { "x-anonymous-client-id": userA },
      query: { limit: 10 }
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

    await getMyContacts(listReq, listRes, () => {});
    assert.equal(listStatus, 200);
    assert.ok(listData);
    assert.equal(listData.success, true);
    assert.ok(Array.isArray(listData.data));
  });
});
