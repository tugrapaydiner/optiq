import type { StandaloneExportArtifact } from "./standalone";

export function downloadStandaloneExport(
  artifact: StandaloneExportArtifact,
): void {
  const objectUrl = URL.createObjectURL(
    new Blob([artifact.html], { type: artifact.mimeType }),
  );
  const link = document.createElement("a");
  link.download = artifact.filename;
  link.href = objectUrl;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
