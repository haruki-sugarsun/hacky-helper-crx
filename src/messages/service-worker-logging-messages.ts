// Message types for event logging
export const LOG_EVENT = "LOG_EVENT";
export const QUERY_LOGS = "QUERY_LOGS";
export const CLEAR_LOGS = "CLEAR_LOGS";
export const EXPORT_LOGS = "EXPORT_LOGS";
export const SET_LOGGING_CONFIG = "SET_LOGGING_CONFIG";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface EventLogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  type: string;
  message?: string;
  context?: Record<string, unknown>;
  source?: string;
}

export interface LogEventMessage {
  type: typeof LOG_EVENT;
  payload: Partial<EventLogEntry> & { type: string };
}

export interface QueryLogsPayload {
  level?: LogLevel[];
  type?: string[];
  fromTs?: number;
  toTs?: number;
  limit?: number;
  offset?: number;
}

export interface QueryLogsResult {
  type: typeof QUERY_LOGS;
  payload: {
    entries: EventLogEntry[];
    total: number;
  };
}
