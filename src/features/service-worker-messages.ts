// General Result Types:
export interface SuccessResult {
  success: boolean;
}
export interface ErrorResult {
  error: string;
}

// Names Sessions:
export const GET_NAMED_SESSIONS = "GET_NAMED_SESSIONS";
export const CLONE_NAMED_SESSION = "CLONE_NAMED_SESSION";
export const REASSOCIATE_NAMED_SESSION = "REASSOCIATE_NAMED_SESSION";
export const TAKEOVER_TAB = "TAKEOVER_TAB";
export const GET_SAVED_BOOKMARKS = "GET_SAVED_BOOKMARKS";
export const GET_SYNCED_OPENTABS = "GET_SYNCED_OPENTABS";
