/**
 * Companion files that must follow a chapter delete or id rename: the
 * chapter's frozen copies in stored translations (`SOURCE/locale/<tag>/text/`,
 * process/TRANSLATION_EDITIONS.md) and its track-changes base snapshot
 * (`SOURCE/main/SOURCE/text/`). Without the sweep, a rename strands these
 * under the old id — they silently vanish from the editor's dropdown and the
 * Changes view. The chapter's own `SOURCE/text/` files are handled directly
 * by the spine service.
 */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function companionPattern(chapterId: string): RegExp {
  return new RegExp(
    `^SOURCE/(?:locale/[^/]+/text|main/SOURCE/text)/${escapeRegExp(chapterId)}\\.(?:txt|json)$`
  );
}

/** The companion paths for `chapterId` among `paths`. */
export function chapterCompanionFiles(paths: string[], chapterId: string): string[] {
  const pattern = companionPattern(chapterId);
  return paths.filter(path => pattern.test(path));
}

/** A companion path's destination when the chapter id changes. */
export function renamedCompanionPath(path: string, oldId: string, newId: string): string {
  return path.replace(new RegExp(`/${escapeRegExp(oldId)}\\.(txt|json)$`), `/${newId}.$1`);
}
