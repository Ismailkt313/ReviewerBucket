import crypto from "crypto";
import { AppError } from "../errors/app-error";

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest();

  const encodedSignature = base64UrlEncode(signature.toString("binary"));
  return `${data}.${encodedSignature}`;
}

export function verifyJwt<T = Record<string, unknown>>(token: string, secret: string): T {
  if (!token || typeof token !== "string") {
    throw new AppError(401, "Invalid token structure");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError(401, "Invalid token structure");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignatureBuffer = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest();

  const expectedSignatureB64 = base64UrlEncode(expectedSignatureBuffer.toString("binary"));

  const signatureBuf = Buffer.from(encodedSignature);
  const expectedBuf = Buffer.from(expectedSignatureB64);

  if (
    signatureBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    throw new AppError(401, "Invalid token signature");
  }

  try {
    const decodedPayloadStr = base64UrlDecode(encodedPayload);
    return JSON.parse(decodedPayloadStr) as T;
  } catch {
    throw new AppError(401, "Malformed token payload");
  }
}
