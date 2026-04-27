export class AdminApiInputError extends Error {}

export async function parseJsonBody<T>(
  request: Request,
  parse: (body: unknown) => T
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: parse(await request.json()) };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof AdminApiInputError) {
      return {
        ok: false,
        response: Response.json(
          { error: error.message || "Invalid JSON body" },
          { status: 400 }
        ),
      };
    }

    throw error;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AdminApiInputError(`Missing ${fieldName}`);
  }

  return value;
}

export function asNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return asRequiredString(value, fieldName);
}

export function asOptionalNullableString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = asRequiredString(value, fieldName).trim();
  return normalized.length > 0 ? normalized : null;
}

export function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new AdminApiInputError(`Missing ${fieldName}`);
  }

  return value;
}