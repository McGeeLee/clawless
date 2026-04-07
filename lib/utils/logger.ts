type LogLevel = 'log' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown> | undefined;

function formatTimePart(value: number) {
  return value.toString().padStart(2, '0');
}

function getTimestamp() {
  const now = new Date();
  const hours = formatTimePart(now.getHours());
  const minutes = formatTimePart(now.getMinutes());

  return `${hours}:${minutes}`;
}

function formatLevel(level: LogLevel) {
  return level.toUpperCase();
}

function write(
  level: LogLevel,
  scope: string,
  message: string,
  context?: LogContext,
) {
  const prefix = `[${getTimestamp()}][${formatLevel(level)}] [(${scope})]`;
  if (context) {
    console[level](`${prefix} ${message}`, context);
    return;
  }
  console[level](`${prefix} ${message}`);
}

export function createLogger(scope: string) {
  return {
    log: (message: string, context?: LogContext) =>
      write('log', scope, message, context),
    info: (message: string, context?: LogContext) =>
      write('info', scope, message, context),
    warn: (message: string, context?: LogContext) =>
      write('warn', scope, message, context),
    error: (message: string, context?: LogContext) =>
      write('error', scope, message, context),
  };
}
