import { Platform } from "react-native";

// In development on Android emulator, localhost maps to 10.0.2.2
const defaultApiUrl =
  Platform.OS === "android" ? "http://10.0.2.2:4000/api/v1" : "http://localhost:4000/api/v1";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? defaultApiUrl;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new ApiError(res.status, json.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}
