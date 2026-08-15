import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { Request, Response, NextFunction } from "express";
import { connectDatabase } from "../../config/database.js";
import { env } from "../../config/env.js";
import { signJwt } from "../../utils/jwt.js";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";
import { ReviewerModel } from "./reviewer.model.js";
import { ReviewerUpdateRequestModel } from "./reviewer-update-request.model.js";
import { ReviewerService } from "./reviewer.service.js";
import { ReviewerUpdateRequestService } from "./reviewer-update-request.service.js";
import {
  getAllRequests,
  approveRequest,
  rejectRequest,
  getAllUpdateRequests,
  approveUpdateRequest,
  rejectUpdateRequest,
  createReviewer,
  updateReviewer
} from "./reviewer.controller.js";
import { AppError } from "../../errors/app-error.js";

describe("Module 2: Existing Admin Feature Protection Tests", () => {
  const reviewerService = new ReviewerService();
  const updateRequestService = new ReviewerUpdateRequestService();

  const validAdminToken = signJwt({ sub: "admin", role: "ADMIN" }, env.JWT_SECRET);
  const userToken = signJwt({ sub: "user-123", role: "USER" }, env.JWT_SECRET);
  const invalidToken = "invalid.token.structure";

  before(async () => {
    await connectDatabase();
    await ReviewerModel.init();
    await ReviewerUpdateRequestModel.init();
    await ReviewerModel.deleteMany({ code: { $regex: /^(TRP|PUB|ORG|PBR)/ } });
    await ReviewerUpdateRequestModel.deleteMany({});
  });

  // ─── Requests Protection Tests ──────────────────────────────────────────────

  test("1. Unauthenticated access to /requests is rejected with 401 Unauthorized", () => {
    const req = { headers: {} } as Request;
    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("2. Invalid JWT on /requests is rejected with 401 Unauthorized", () => {
    const req = {
      headers: { authorization: `Bearer ${invalidToken}` }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("3. Non-admin JWT on /requests is rejected with 403 Forbidden", () => {
    const req = {
      headers: { authorization: `Bearer ${userToken}` }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 403);
  });

  test("4. Valid ADMIN JWT can access request management", async () => {
    const req = {
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as unknown as Request;

    let authPassed = false;

    requireAdminAuth(req, {} as Response, ((err?: unknown) => {
      if (!err) authPassed = true;
    }) as NextFunction);

    assert.equal(authPassed, true);
    assert.equal(req.admin?.role, "ADMIN");

    // Execute request controller
    let jsonResult: unknown;
    const res = {
      status: (code: number) => {
        assert.equal(code, 200);
        return {
          json: (data: unknown) => {
            jsonResult = data;
          }
        };
      }
    } as Response;

    await getAllRequests(req, res, () => {});
    assert.ok(jsonResult && typeof jsonResult === "object");
    assert.equal((jsonResult as { success: boolean }).success, true);
  });

  test("5. Admin can approve a pending reviewer request when authorized", async () => {
    // Create pending reviewer request
    const pendingReviewer = await reviewerService.createReviewer({
      name: "Test Reviewer For Protection",
      code: "TRP01",
      stacks: ["MERN"],
      status: "PENDING"
    });

    const req = {
      params: { id: pendingReviewer._id.toString() },
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as unknown as Request;

    let authPassed = false;
    requireAdminAuth(req, {} as Response, ((err?: unknown) => {
      if (!err) authPassed = true;
    }) as NextFunction);

    assert.equal(authPassed, true);

    let resData: { success: boolean; data: { status: string } } | undefined;
    const res = {
      status: (code: number) => {
        assert.equal(code, 200);
        return {
          json: (data: unknown) => {
            resData = data as typeof resData;
          }
        };
      }
    } as Response;

    await approveRequest(req, res, () => {});

    assert.ok(resData);
    assert.equal(resData.success, true);
    assert.equal(resData.data.status, "APPROVED");

    // Clean up
    await ReviewerModel.deleteOne({ _id: pendingReviewer._id });
  });

  test("6. Public user request submission (createReviewer) remains accessible without token", async () => {
    const uniqueCode = `PUB${Date.now().toString().slice(-4)}`;
    const req = {
      body: {
        name: "Public Candidate",
        code: uniqueCode,
        stacks: ["Golang"]
      }
    } as Request;

    let resData: { success: boolean; data: { reviewerCode: string; status: string } } | undefined;
    const res = {
      status: (code: number) => {
        assert.equal(code, 201);
        return {
          json: (data: unknown) => {
            resData = data as typeof resData;
          }
        };
      }
    } as Response;

    await createReviewer(req, res, () => {});

    assert.ok(resData);
    assert.equal(resData.success, true);
    assert.equal(resData.data.reviewerCode, uniqueCode);
    assert.equal(resData.data.status, "PENDING");

    // Clean up
    await ReviewerModel.deleteOne({ code: uniqueCode });
  });

  // ─── Update Requests Protection Tests ──────────────────────────────────────

  test("7. Unauthenticated access to /update-requests is rejected with 401 Unauthorized", () => {
    const req = { headers: {} } as Request;
    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("8. Invalid JWT on /update-requests is rejected with 401 Unauthorized", () => {
    const req = {
      headers: { authorization: `Bearer ${invalidToken}` }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("9. Non-admin JWT on /update-requests is rejected with 403 Forbidden", () => {
    const req = {
      headers: { authorization: `Bearer ${userToken}` }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 403);
  });

  test("10. Valid ADMIN JWT can access update-requests management", async () => {
    const req = {
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as unknown as Request;

    let authPassed = false;
    requireAdminAuth(req, {} as Response, ((err?: unknown) => {
      if (!err) authPassed = true;
    }) as NextFunction);

    assert.equal(authPassed, true);

    let jsonResult: unknown;
    const res = {
      status: (code: number) => {
        assert.equal(code, 200);
        return {
          json: (data: unknown) => {
            jsonResult = data;
          }
        };
      }
    } as Response;

    await getAllUpdateRequests(req, res, () => {});
    assert.ok(jsonResult && typeof jsonResult === "object");
    assert.equal((jsonResult as { success: boolean }).success, true);
  });

  test("11. Admin can approve update requests when authorized with valid ADMIN JWT", async () => {
    const code11 = `ORG${Date.now().toString().slice(-4)}`;
    // Create base reviewer
    const reviewer = await reviewerService.createReviewer({
      name: "Original Name",
      code: code11,
      stacks: ["Python"],
      status: "APPROVED"
    });

    // Create update request
    const updateReq = await updateRequestService.submitUpdateRequest({
      reviewerId: reviewer._id.toString(),
      name: "Updated Name Proposed",
      code: code11,
      stacks: ["Python", "AI/ML"]
    });

    const req = {
      params: { id: updateReq._id.toString() },
      body: { reviewedBy: "admin" },
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as unknown as Request;

    let authPassed = false;
    requireAdminAuth(req, {} as Response, ((err?: unknown) => {
      if (!err) authPassed = true;
    }) as NextFunction);

    assert.equal(authPassed, true);

    let resData: { success: boolean; data: { status: string } } | undefined;
    const res = {
      status: (code: number) => {
        assert.equal(code, 200);
        return {
          json: (data: unknown) => {
            resData = data as typeof resData;
          }
        };
      }
    } as Response;

    await approveUpdateRequest(req, res, () => {});

    assert.ok(resData);
    assert.equal(resData.success, true);
    assert.equal(resData.data.status, "APPROVED");

    // Clean up
    await ReviewerUpdateRequestModel.deleteOne({ _id: updateReq._id });
    await ReviewerModel.deleteOne({ _id: reviewer._id });
  });

  test("12. Public user update request submission (updateReviewer) remains accessible without token", async () => {
    const code12 = `PBR${Date.now().toString().slice(-4)}`;
    const reviewer = await reviewerService.createReviewer({
      name: "Public Base Reviewer",
      code: code12,
      stacks: ["Flutter"],
      status: "APPROVED"
    });

    const req = {
      params: { id: reviewer._id.toString() },
      body: {
        name: "Proposed Flutter Pro",
        code: code12,
        stacks: ["Flutter", "MERN"]
      }
    } as unknown as Request;

    let resData: { success: boolean; data: { status: string } } | undefined;
    const res = {
      status: (code: number) => {
        assert.equal(code, 201);
        return {
          json: (data: unknown) => {
            resData = data as typeof resData;
          }
        };
      }
    } as Response;

    await updateReviewer(req, res, () => {});

    assert.ok(resData);
    assert.equal(resData.success, true);
    assert.equal(resData.data.status, "PENDING");

    // Clean up
    await ReviewerUpdateRequestModel.deleteMany({ reviewerId: reviewer._id.toString() });
    await ReviewerModel.deleteOne({ _id: reviewer._id });
  });

  test("13. Admin can reject a reviewer request when authorized", async () => {
    const pendingReviewer = await reviewerService.createReviewer({
      name: "Reject Candidate",
      code: `REJ${Date.now().toString().slice(-4)}`,
      stacks: ["Python"],
      status: "PENDING"
    });

    const req = {
      params: { id: pendingReviewer._id.toString() },
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as unknown as Request;

    let resData: { success: boolean; data: { status: string } } | undefined;
    const res = {
      status: (code: number) => {
        assert.equal(code, 200);
        return {
          json: (data: unknown) => {
            resData = data as typeof resData;
          }
        };
      }
    } as Response;

    await rejectRequest(req, res, () => {});

    assert.ok(resData);
    assert.equal(resData.success, true);
    assert.equal(resData.data.status, "REJECTED");

    await ReviewerModel.deleteOne({ _id: pendingReviewer._id });
  });

  test("14. Admin can reject an update request when authorized", async () => {
    const code = `RJU${Date.now().toString().slice(-4)}`;
    const reviewer = await reviewerService.createReviewer({
      name: "Reviewer For Update Reject",
      code,
      stacks: ["Golang"],
      status: "APPROVED"
    });

    const updateReq = await updateRequestService.submitUpdateRequest({
      reviewerId: reviewer._id.toString(),
      name: "Bad Proposal",
      code,
      stacks: ["Golang"]
    });

    const req = {
      params: { id: updateReq._id.toString() },
      body: { rejectionReason: "Invalid changes", reviewedBy: "admin" },
      headers: { authorization: `Bearer ${validAdminToken}` }
    } as unknown as Request;

    let resData: { success: boolean; data: { status: string; rejectionReason: string } } | undefined;
    const res = {
      status: (code: number) => {
        assert.equal(code, 200);
        return {
          json: (data: unknown) => {
            resData = data as typeof resData;
          }
        };
      }
    } as Response;

    await rejectUpdateRequest(req, res, () => {});

    assert.ok(resData);
    assert.equal(resData.success, true);
    assert.equal(resData.data.status, "REJECTED");
    assert.equal(resData.data.rejectionReason, "Invalid changes");

    await ReviewerUpdateRequestModel.deleteOne({ _id: updateReq._id });
    await ReviewerModel.deleteOne({ _id: reviewer._id });
  });
});
