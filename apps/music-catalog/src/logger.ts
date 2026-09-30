type LogFields = Record<string, unknown>;

export type Logger = {
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
};

export type LoggerOptions = {
  name: string;
  /** One JSON object per line (production, for log collectors) or text. */
  json: boolean;
  /** Where `info` goes. Defaults to stdout. */
  out?: (line: string) => void;
  /** Where `warn` and `error` go. Defaults to stderr. */
  err?: (line: string) => void;
};

type Level = 'info' | 'warn' | 'error';

// JSON.stringify turns an Error into `{}`, which would lose the stack.
const serializeField = (value: unknown): unknown =>
  value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack }
    : value;

const serializeFields = (fields: LogFields): LogFields =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serializeField(value)]),
  );

const formatLine = (
  options: LoggerOptions,
  level: Level,
  message: string,
  fields: LogFields,
): string => {
  const time = new Date().toISOString();
  const serialized = serializeFields(fields);
  if (options.json) {
    return `${JSON.stringify({ level, time, name: options.name, message, ...serialized })}\n`;
  }
  const details =
    Object.keys(serialized).length > 0 ? ` ${JSON.stringify(serialized)}` : '';
  return `${time} ${level.toUpperCase()} [${options.name}] ${message}${details}\n`;
};

/**
 * A minimal structured logger: this app runs without a framework, and
 * `console.log` is a lint error. Never pass secrets, API keys or whole
 * request bodies as fields.
 */
export const createLogger = (options: LoggerOptions): Logger => {
  const out = options.out ?? ((line) => process.stdout.write(line));
  const err = options.err ?? ((line) => process.stderr.write(line));
  const log =
    (level: Level, write: (line: string) => void) =>
    (message: string, fields: LogFields = {}) => {
      write(formatLine(options, level, message, fields));
    };
  return {
    info: log('info', out),
    warn: log('warn', err),
    error: log('error', err),
  };
};
