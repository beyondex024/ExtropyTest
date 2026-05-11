import jwt from "jsonwebtoken";
import type { AppEnv } from "./env.js";

const ISS = "extropy-expense-api";
const AUD = "extropy-web";

export function signAccessToken(env: AppEnv, userId: string): string {
  return jwt.sign({ typ: "access" }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: "7d",
    issuer: ISS,
    audience: AUD
  });
}

export function verifyAccessToken(env: AppEnv, token: string): { userId: string } {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISS,
    audience: AUD
  });
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("invalid_token");
  }
  return { userId: decoded.sub };
}
