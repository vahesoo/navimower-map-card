const VERSION_INFO_LOG = /(^[ \t]*)console\.info\(\s*([\"'\`])\[Navimower Map Card\]\s+v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?[^\"'\`\r\n]*\2\s*,?\s*\);[ \t]*(?:\r?\n)?/gm;

export function normalizeRuntimeVersionLog(source, version) {
  if (typeof source !== "string") throw new TypeError("Runtime source must be a string");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid runtime version: ${version}`);
  }

  const cleaned = source.replace(VERSION_INFO_LOG, "");
  return `${cleaned.trimEnd()}\n\nconsole.info("[Navimower Map Card] v${version} loaded");\n`;
}
