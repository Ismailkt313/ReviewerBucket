import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response, NextFunction } from "express";
import { connectDatabase, disconnectDatabase } from "../../config/database.js";
import { ReviewerModel } from "../reviewers/reviewer.model.js";
import { RatingModel } from "./rating.model.js";
import { ratingSubmissionLimiter } from "./rating.limiter.js";
import app from "../../app.js";

describe("Ratings Rate Limiting Integration & Unit Tests", () => {
  let server: Server;
  let baseUrl: string;
  let reviewerId: string;
  const testReviewerCode = `RLT${Date.now().toString().slice(-4)}`;

  before(async () => {
    await connectDatabase();
    await ReviewerModel.init();
    await RatingModel.init();

    // Create a test reviewer to use for ratings
    const reviewer = await ReviewerModel.create({
      name: "Rate Limiter Test Reviewer",
      code: testReviewerCode,
      slug: `rate-limiter-test-${Date.now()}`,
      status: "APPROVED",
      stacks: ["Node.js", "TypeScript"]
    });
    reviewerId = reviewer._id.toString();

    // Start HTTP server on dynamic port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (reviewerId) {
      await RatingModel.deleteMany({ reviewerId });
      await ReviewerModel.deleteOne({ _id: reviewerId });
    }
    await disconnectDatabase();
  });

  test("1. First 5 rating submissions from the same IP succeed (200 OK)", async () => {
    for (let i = 1; i <= 5; i++) {
      const response = await fetch(`${baseUrl}/api/reviewers/${reviewerId}/rating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousClientId: "11111111-2222-3333-4444-555555555555",
          value: (i % 5) + 1
        })
      });

      const body = await response.json() as { success: boolean; data?: { value: number } };
      assert.equal(
        response.status,
        200,
        `Submission #${i} should return 200 OK but got ${response.status}`
      );
      assert.equal(body.success, true);
      assert.ok(body.data);
    }
  });

  test("2. 6th rating submission from the same IP is blocked with 429 Too Many Requests", async () => {
    const response = await fetch(`${baseUrl}/api/reviewers/${reviewerId}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousClientId: "11111111-2222-3333-4444-555555555555",
        value: 5
      })
    });

    const body = await response.json() as { success: boolean; message: string };
    assert.equal(response.status, 429, "6th request must return HTTP 429 Too Many Requests");
    assert.equal(body.success, false);
    assert.match(body.message, /too many/i);
    assert.match(body.message, /5 minutes/i);
  });

  test("3. GET rating summary endpoint remains accessible and unaffected by rate limiter", async () => {
    const response = await fetch(`${baseUrl}/api/reviewers/${reviewerId}/rating-summary`);
    const body = await response.json() as {
      success: boolean;
      data?: { averageRating: number | null; ratingCount: number };
    };

    assert.equal(
      response.status,
      200,
      "Rating summary endpoint must not be blocked by rating submission rate limiter"
    );
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.ok(body.data.ratingCount >= 1);
  });

  test("4. Unrelated endpoint GET /api/health remains unaffected by rate limiter", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json() as { success: boolean; message: string };

    assert.equal(response.status, 200, "Health check endpoint must return 200 OK");
    assert.equal(body.success, true);
    assert.equal(body.message, "Reviewer Bucket API is running");
  });

  test("5. Unrelated endpoint GET /api/reviewers remains unaffected by rate limiter", async () => {
    const response = await fetch(`${baseUrl}/api/reviewers`);
    const body = await response.json() as { success: boolean; data?: unknown[] };

    assert.equal(response.status, 200, "Reviewers browsing endpoint must return 200 OK");
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test("6. Unit test: ratingSubmissionLimiter enforces per-IP isolation", async () => {
    // Test with mock requests simulating different client IPs
    const ipA = "192.0.2.1";
    const ipB = "198.51.100.1";

    const createMockReq = (ip: string): Request =>
      ({
        ip,
        headers: {},
        app: { get: () => false }
      }) as unknown as Request;

    const runLimiter = (req: Request): Promise<{ status: number; body?: unknown; nextCalled: boolean }> => {
      return new Promise((resolve) => {
        let status = 200;
        let body: unknown;
        const res = {
          status(code: number) {
            status = code;
            return this;
          },
          json(payload: unknown) {
            body = payload;
            resolve({ status, body, nextCalled: false });
            return this;
          },
          setHeader() {
            return this;
          },
          getHeader() {
            return undefined;
          }
        } as unknown as Response;

        const next: NextFunction = () => {
          resolve({ status: 200, nextCalled: true });
        };

        ratingSubmissionLimiter(req, res, next);
      });
    };

    // IP B has not made any requests yet, so it should pass immediately
    const resultIpB1 = await runLimiter(createMockReq(ipB));
    assert.equal(resultIpB1.nextCalled, true, "IP B's 1st request should call next()");

    // IP A makes 5 requests
    for (let i = 1; i <= 5; i++) {
      const resultA = await runLimiter(createMockReq(ipA));
      assert.equal(resultA.nextCalled, true, `IP A request #${i} should call next()`);
    }

    // IP A's 6th request should be rejected with 429
    const resultA6 = await runLimiter(createMockReq(ipA));
    assert.equal(resultA6.nextCalled, false);
    assert.equal(resultA6.status, 429, "IP A's 6th request should be rate limited to 429");
    const errBody = resultA6.body as { success: boolean; message: string };
    assert.equal(errBody.success, false);
    assert.match(errBody.message, /too many/i);

    // IP B can still make requests because IP A's limit does not affect IP B
    const resultIpB2 = await runLimiter(createMockReq(ipB));
    assert.equal(resultIpB2.nextCalled, true, "IP B should not be affected by IP A's rate limit");
  });
});
