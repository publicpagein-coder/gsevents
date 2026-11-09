import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";

export function validate<T>(
  schema: ZodSchema<T>,
  source: "body" | "query" | "params" = "body",
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        issues,
      });
      return;
    }
    // Attach parsed & coerced data back to the request
    (req as Request & { [key: string]: unknown })[source] = result.data;
    next();
  };
}
