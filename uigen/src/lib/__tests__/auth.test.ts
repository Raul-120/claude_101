// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ set: mockSet, get: mockGet, delete: mockDelete })
  ),
}));

const { createSession } = await import("@/lib/auth");

const DEV_SECRET = new TextEncoder().encode("development-secret-key");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_S = SEVEN_DAYS_MS / 1000;

beforeEach(() => {
  vi.clearAllMocks();
});

test("sets the auth-token cookie", async () => {
  await createSession("user-123", "test@example.com");
  expect(mockSet).toHaveBeenCalledOnce();
  expect(mockSet.mock.calls[0][0]).toBe("auth-token");
});

test("JWT payload contains userId and email", async () => {
  await createSession("user-123", "test@example.com");
  const token: string = mockSet.mock.calls[0][1];
  const { payload } = await jwtVerify(token, DEV_SECRET);
  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
});

test("JWT expires in 7 days", async () => {
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-123", "test@example.com");
  const token: string = mockSet.mock.calls[0][1];
  const { payload } = await jwtVerify(token, DEV_SECRET);
  expect(payload.exp).toBeGreaterThanOrEqual(before + SEVEN_DAYS_S - 5);
  expect(payload.exp).toBeLessThanOrEqual(before + SEVEN_DAYS_S + 5);
});

test("cookie is httpOnly", async () => {
  await createSession("user-123", "test@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.httpOnly).toBe(true);
});

test("cookie has sameSite lax and path /", async () => {
  await createSession("user-123", "test@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("cookie expires in approximately 7 days", async () => {
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();
  const { expires } = mockSet.mock.calls[0][2];
  expect(expires.getTime()).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + SEVEN_DAYS_MS + 1000);
});

test("cookie is not secure outside production", async () => {
  await createSession("user-123", "test@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.secure).toBe(false);
});

test("cookie is secure in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await createSession("user-123", "test@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.secure).toBe(true);
  vi.unstubAllEnvs();
});
