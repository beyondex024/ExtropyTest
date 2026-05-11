/**
 * Server-safe text cleanup for expense descriptions and category names.
 * Escapes HTML-sensitive characters and clamps length.
 */
export function sanitizePlainText(input: string, maxLength: number): string {
  const trimmed = input.trim().slice(0, maxLength);
  return trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
