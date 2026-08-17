type LogContext = Record<string, string | number | boolean | undefined>;

function safeContext(context?: LogContext) {
  return context ? Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)) : undefined;
}

export const logger = {
  info(event: string, context?: LogContext) { console.info(event, safeContext(context)); },
  warn(event: string, context?: LogContext) { console.warn(event, safeContext(context)); },
  error(event: string, context?: LogContext) { console.error(event, safeContext(context)); },
};
