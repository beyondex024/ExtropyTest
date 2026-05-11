type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function currentLevel(): Level {
  const l = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (l === "debug" || l === "warn" || l === "error") return l;
  return "info";
}

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta
  };
  // Basic structured logging for CloudWatch
  console.log(JSON.stringify(line));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta)
};
