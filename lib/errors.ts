export function publicError(message: string): Error {
  return new Error(message);
}

export function internalErrorLog(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown";
  console.error(`[${scope}] ${message}`);
}
