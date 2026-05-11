import { describe, expect, it } from "vitest";
import type { AppEnv } from "./env.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

const env: AppEnv = {
  MONGODB_URI: "mongodb://localhost:27017/test",
  JWT_SECRET: "1234567890123456",
  OPENAI_API_KEY: undefined,
  CORS_ORIGIN: undefined,
  LOG_LEVEL: undefined
};

describe("jwt", () => {
  it("roundtrips subject", () => {
    const token = signAccessToken(env, "user123");
    expect(verifyAccessToken(env, token).userId).toBe("user123");
  });
});
