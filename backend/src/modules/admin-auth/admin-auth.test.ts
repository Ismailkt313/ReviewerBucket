import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Request, Response, NextFunction } from "express";
import { AdminAuthService } from "./admin-auth.service.js";
import { validateAdminLogin } from "./admin-auth.validation.js";
import { requireAdminAuth } from "./admin-auth.middleware.js";
import { signJwt, verifyJwt } from "../../utils/jwt.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { AdminJwtPayload } from "./admin-auth.types.js";

describe("Module 1: Admin Authentication & Authorization Tests", () => {
  const service = new AdminAuthService();

  // ─── Login Service & Credentials Tests ──────────────────────────────────────

  test("1. Correct email + password succeeds and returns JWT and admin role", () => {
    const result = service.loginAdmin({
      email: "muhammedismailkt@gmail.com",
      password: "ismail"
    });

    assert.ok(result.token, "Token should be present in response");
    assert.equal(result.admin.role, "ADMIN");
  });

  test("2. Incorrect email fails with 401 Unauthorized", () => {
    assert.throws(
      () => {
        service.loginAdmin({
          email: "wrongadmin@gmail.com",
          password: "ismail"
        });
      },
      (err: unknown) => {
        return err instanceof AppError && err.statusCode === 401 && err.message === "Invalid email or password";
      }
    );
  });

  test("3. Incorrect password fails with 401 Unauthorized", () => {
    assert.throws(
      () => {
        service.loginAdmin({
          email: "muhammedismailkt@gmail.com",
          password: "wrongpassword"
        });
      },
      (err: unknown) => {
        return err instanceof AppError && err.statusCode === 401 && err.message === "Invalid email or password";
      }
    );
  });

  test("4. Case-insensitive email credential matching succeeds", () => {
    const result = service.loginAdmin({
      email: "MUHAMMEDISMAILKT@GMAIL.COM",
      password: "ismail"
    });

    assert.ok(result.token);
    assert.equal(result.admin.role, "ADMIN");
  });

  // ─── JWT Payload & Structure Tests ─────────────────────────────────────────

  test("5. Generated JWT contains 'sub': 'admin' and 'role': 'ADMIN'", () => {
    const result = service.loginAdmin({
      email: "muhammedismailkt@gmail.com",
      password: "ismail"
    });

    const payload = verifyJwt<AdminJwtPayload>(result.token, env.JWT_SECRET);
    assert.equal(payload.sub, "admin");
    assert.equal(payload.role, "ADMIN");
  });

  test("6. Generated JWT does NOT contain sensitive password or hash", () => {
    const result = service.loginAdmin({
      email: "muhammedismailkt@gmail.com",
      password: "ismail"
    });

    const payload = verifyJwt<Record<string, unknown>>(result.token, env.JWT_SECRET);
    assert.equal(payload.password, undefined);
    assert.equal(payload.ismail, undefined);
  });

  test("7. Generated JWT has NO expiration ('exp' is undefined)", () => {
    const result = service.loginAdmin({
      email: "muhammedismailkt@gmail.com",
      password: "ismail"
    });

    const payload = verifyJwt<Record<string, unknown>>(result.token, env.JWT_SECRET);
    assert.equal(payload.exp, undefined);
  });

  // ─── Input Validation Middleware Tests ────────────────────────────────────

  test("8. Missing email fails validation with 400 Bad Request", () => {
    const req = { body: { password: "ismail" } } as Request;
    let caughtError: unknown;

    validateAdminLogin(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 400);
  });

  test("9. Missing password fails validation with 400 Bad Request", () => {
    const req = { body: { email: "muhammedismailkt@gmail.com" } } as Request;
    let caughtError: unknown;

    validateAdminLogin(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 400);
  });

  test("10. Invalid email format fails validation with 400 Bad Request", () => {
    const req = { body: { email: "not-an-email", password: "ismail" } } as Request;
    let caughtError: unknown;

    validateAdminLogin(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 400);
  });

  // ─── Middleware / Guard Authorization Tests ────────────────────────────────

  test("11. Valid admin JWT passes requireAdminAuth and attaches request context", () => {
    const token = signJwt({ sub: "admin", role: "ADMIN" }, env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${token}` }
    } as unknown as Request;

    let calledNext = false;
    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, ((err?: unknown) => {
      if (err) caughtError = err;
      else calledNext = true;
    }) as NextFunction);

    assert.equal(calledNext, true);
    assert.equal(caughtError, undefined);
    assert.deepEqual(req.admin, { sub: "admin", role: "ADMIN" });
    assert.deepEqual(req.user, { sub: "admin", role: "ADMIN" });
  });

  test("12. Missing Authorization header is rejected with 401", () => {
    const req = { headers: {} } as Request;
    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("13. Malformed Authorization header (missing 'Bearer ') is rejected with 401", () => {
    const req = {
      headers: { authorization: "Basic token123" }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("14. Invalid JWT signature is rejected with 401", () => {
    const tokenWithWrongSecret = signJwt({ sub: "admin", role: "ADMIN" }, "wrong-secret-key");
    const req = {
      headers: { authorization: `Bearer ${tokenWithWrongSecret}` }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("15. JWT with non-admin role (e.g. 'USER') is rejected with 403 Forbidden", () => {
    const token = signJwt({ sub: "user-123", role: "USER" }, env.JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${token}` }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 403);
  });

  test("16. Corrupted/tampered JWT string is rejected with 401", () => {
    const req = {
      headers: { authorization: "Bearer invalid.corrupted.jwt.string" }
    } as unknown as Request;

    let caughtError: unknown;

    requireAdminAuth(req, {} as Response, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError instanceof AppError);
    assert.equal((caughtError as AppError).statusCode, 401);
  });

  test("17. Verification error messages do not reveal sensitive secrets or internal trace details", () => {
    const req = {
      headers: { authorization: "Bearer garbage-token" }
    } as unknown as Request;

    let caughtError: AppError | undefined;

    requireAdminAuth(req, {} as Response, (err) => {
      if (err instanceof AppError) caughtError = err;
    });

    assert.ok(caughtError);
    assert.doesNotMatch(caughtError.message, new RegExp(env.JWT_SECRET, "i"));
    assert.doesNotMatch(caughtError.message, /ismail/i);
  });
});
