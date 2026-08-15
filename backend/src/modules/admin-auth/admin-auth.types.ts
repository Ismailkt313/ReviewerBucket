export interface AdminLoginDto {
  email: string;
  password: string;
}

export interface AdminAuthResponse {
  success: boolean;
  data: {
    token: string;
    admin: {
      role: "ADMIN";
    };
  };
}

export interface AdminJwtPayload {
  sub: string;
  role: "ADMIN";
  [key: string]: unknown;
}

export interface AdminUserContext {
  sub: string;
  role: "ADMIN";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminUserContext;
      user?: AdminUserContext;
    }
  }
}
