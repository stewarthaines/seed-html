/**
 * Standardized logging utilities for Storybook stories
 *
 * Provides consistent logging patterns across all workspace demo stories
 */

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface Logger {
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string, details?: any) => void;
  clearLogs: () => void;
  getLogsByLevel: (level: LogEntry['level']) => LogEntry[];
  getRecentLogs: (count: number) => LogEntry[];
}

/**
 * Create a logger instance for a story
 */
export function createLogger(): Logger {
  let logs: LogEntry[] = [];
  let logCounter = 0;

  const addLog = (level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
      id: `log-${++logCounter}`,
      timestamp: new Date(),
      level,
      message,
      details,
    };

    logs = [...logs, entry];

    // Console logging for debugging
    const consoleMethod =
      level === 'error'
        ? 'error'
        : level === 'warning'
          ? 'warn'
          : level === 'success'
            ? 'log'
            : 'log';
    console[consoleMethod](`[Story Log] ${message}`, details || '');
  };

  const clearLogs = () => {
    logs = [];
    logCounter = 0;
  };

  const getLogsByLevel = (level: LogEntry['level']) => {
    return logs.filter(log => log.level === level);
  };

  const getRecentLogs = (count: number) => {
    return logs.slice(-count);
  };

  return {
    get logs() {
      return logs;
    },
    addLog,
    clearLogs,
    getLogsByLevel,
    getRecentLogs,
  };
}

/**
 * Format a log entry for display
 */
export function formatLogEntry(entry: LogEntry): string {
  const time = entry.timestamp.toLocaleTimeString();
  const level = entry.level.toUpperCase().padEnd(7);
  return `[${time}] ${level} ${entry.message}`;
}

/**
 * Get CSS classes for log level styling
 */
export function getLogLevelClass(level: LogEntry['level']): string {
  const classes = {
    info: 'log-info',
    success: 'log-success',
    warning: 'log-warning',
    error: 'log-error',
  };
  return classes[level] || 'log-info';
}

/**
 * Create a log display component state
 */
export interface LogDisplayState {
  showLogs: boolean;
  filterLevel: LogEntry['level'] | 'all';
  maxDisplayLogs: number;
}

export function createLogDisplayState(): LogDisplayState {
  return {
    showLogs: true,
    filterLevel: 'all',
    maxDisplayLogs: 50,
  };
}

/**
 * Filter logs based on display state
 */
export function filterLogs(logs: LogEntry[], state: LogDisplayState): LogEntry[] {
  let filtered =
    state.filterLevel === 'all' ? logs : logs.filter(log => log.level === state.filterLevel);

  return filtered.slice(-state.maxDisplayLogs);
}
