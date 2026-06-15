/** Human-readable file size: KB, switching to MB once it reaches 1024 KB (1 MB). */
export function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb.toFixed(0)} KB`;
}
