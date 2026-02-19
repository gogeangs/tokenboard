export function publicError(message: string): Error {
  return new Error(message);
}

export function internalErrorLog(scope: string, error: unknown): void {
  const detail = error instanceof Error ? error.stack ?? error.message : "unknown";
  console.error(`[${scope}] ${detail}`);
}
