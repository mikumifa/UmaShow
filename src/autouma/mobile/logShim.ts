const log = {
  debug: (...values: unknown[]) => console.debug(...values),
  info: (...values: unknown[]) => console.info(...values),
  warn: (...values: unknown[]) => console.warn(...values),
  error: (...values: unknown[]) => console.error(...values),
};

export default log;
