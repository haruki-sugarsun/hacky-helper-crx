import {
  ClosedNamedSession,
  NamedSession,
  NamedSessionTab,
  SyncedTabEntity,
} from "../lib/types";

type ExportableSession = Pick<
  NamedSession,
  "id" | "name" | "createdAt" | "updatedAt"
>;

export interface NamedSessionExport {
  format: "hacky-helper-session";
  version: 1;
  exportedAt: string;
  session: ExportableSession;
  openedTabs: Array<Pick<NamedSessionTab, "title" | "url">>;
  savedBookmarks: Array<Pick<SyncedTabEntity, "title" | "url">>;
}

/** Creates a portable JSON representation of a named session. */
export function buildNamedSessionExport(
  session: NamedSession | ClosedNamedSession,
  openedTabs: SyncedTabEntity[] = [],
  savedBookmarks: SyncedTabEntity[] = [],
  exportedAt = new Date(),
): NamedSessionExport {
  const sessionMetadata: ExportableSession = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };

  const sessionOpenedTabs =
    openedTabs.length > 0 || !("tabs" in session)
      ? openedTabs
      : session.tabs;

  return {
    format: "hacky-helper-session",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    session: sessionMetadata,
    openedTabs: sessionOpenedTabs.map(({ title, url }) => ({ title, url })),
    savedBookmarks: savedBookmarks.map(({ title, url }) => ({ title, url })),
  };
}

/** Downloads a session export as a UTF-8 JSON file. */
export function downloadNamedSessionExport(
  session: NamedSession | ClosedNamedSession,
  data: NamedSessionExport,
): void {
  const safeName = session.name
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  const filename = `hacky-helper-${safeName || "session"}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
