/** Browser origins that may call the API. Non-browser clients send no Origin. */
export const API_ALLOWED_ORIGINS = [
  "https://www.tardadi.com",
  "https://tardadi.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
] as const;

export function isAllowedApiOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return (API_ALLOWED_ORIGINS as readonly string[]).includes(origin);
}
