export const MAX_EXPORT_FILENAME_LENGTH = 80;

const HTML_CHARACTERS: Readonly<Record<string, string>> = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_CHARACTERS[character]!);
}

export function safeExportFilename(title: string): string {
  const wrapperLength = "optiq-".length + ".html".length;
  const slugLimit = MAX_EXPORT_FILENAME_LENGTH - wrapperLength;
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, slugLimit)
    .replace(/-+$/g, "");

  return `optiq-${slug || "lesson"}.html`;
}
