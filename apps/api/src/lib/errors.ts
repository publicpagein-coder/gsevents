import type { Response } from "express";

export function apiError(
  res: Response,
  status: number,
  error: string,
  code: string,
): void {
  res.status(status).json({ error, code });
}
