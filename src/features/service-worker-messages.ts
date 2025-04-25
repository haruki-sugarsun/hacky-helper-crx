// General Result Types:
export interface SuccessResult {
  success: boolean;
}
export interface ErrorResult {
  error: string;
}

// Named Sessions:
export const GET_NAMED_SESSIONS = "GET_NAMED_SESSIONS";
export const CLONE_NAMED_SESSION = "CLONE_NAMED_SESSION";
export const REASSOCIATE_NAMED_SESSION = "REASSOCIATE_NAMED_SESSION";
export const ACTIVATE_SESSION = "ACTIVATE_SESSION";
export const GET_CLOSED_NAMED_SESSIONS = "GET_CLOSED_NAMED_SESSIONS";
export const RESTORE_CLOSED_SESSION = "RESTORE_CLOSED_SESSION";

// SyncedTabEntry
export const TAKEOVER_TAB = "TAKEOVER_TAB";
export const GET_SAVED_BOOKMARKS = "GET_SAVED_BOOKMARKS";
export const GET_SYNCED_OPENTABS = "GET_SYNCED_OPENTABS";
