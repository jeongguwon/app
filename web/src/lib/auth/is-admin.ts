const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "admin@school.ac.kr")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
