export function emailBodyText(email: { text: string | null; html: string | null }): string {
  if (email.text) return email.text;
  if (email.html) return email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}
