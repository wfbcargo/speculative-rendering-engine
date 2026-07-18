interface ProcessHost {
  process?: { env?: { NODE_ENV?: string } };
}

export function isDev(): boolean {
  const host = globalThis as ProcessHost;
  return host.process?.env?.NODE_ENV !== "production";
}
