import crypto from "crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { signJwt } from "../../utils/jwt.js";
import { AdminLoginDto, AdminJwtPayload } from "./admin-auth.types.js";

const HARDCODED_ADMIN_EMAIL = "muhammedismailkt@gmail.com";
const HARDCODED_ADMIN_PASSWORD = "ismail";

export class AdminAuthService {
  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      // Execute timingSafeEqual against self to mitigate timing side channels
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  public validateAdminCredentials(email: string, password: string): boolean {
    const isEmailValid = this.safeCompare(
      email.trim().toLowerCase(),
      HARDCODED_ADMIN_EMAIL.toLowerCase()
    );
    const isPasswordValid = this.safeCompare(password, HARDCODED_ADMIN_PASSWORD);

    return isEmailValid && isPasswordValid;
  }

  public loginAdmin(dto: AdminLoginDto): { token: string; admin: { role: "ADMIN" } } {
    const isValid = this.validateAdminCredentials(dto.email, dto.password);

    if (!isValid) {
      throw new AppError(401, "Invalid email or password");
    }

    const payload: AdminJwtPayload = {
      sub: "admin",
      role: "ADMIN"
    };

    const token = signJwt(payload, env.JWT_SECRET);

    return {
      token,
      admin: {
        role: "ADMIN"
      }
    };
  }
}
