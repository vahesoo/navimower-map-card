const VERSION_INFO_LOG = /(^[ \t]*)console\.info\(\s*([\"'\`])\[Navimower Map Card\]\s+v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?[^\"'\`\r\n]*\2\s*,?\s*\);[ \t]*(?:\r?\n)?/gm;
const LEGACY_STYLED_VERSION_LOG = /console\.info\(\s*`%c NAVIMOWER-MAP-CARD %c v\$\{NAVIMOWER_MAP_CARD_VERSION2?\} `,\s*["'][^"']*["'],\s*["'][^"']*["']\s*\);\s*/g;
const LEGACY_CORE_VERSION = /^var NAVIMOWER_MAP_CARD_VERSION = "0\.2\.2";\s*\r?\n/m;

export function normalizeRuntimeVersionLog(source, version) {
  if (typeof source !== "string") throw new TypeError("Runtime source must be a string");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid runtime version: ${version}`);
  }

  const cleaned = source
    .replace(VERSION_INFO_LOG, "")
    .replace(LEGACY_STYLED_VERSION_LOG, "")
    .replace(LEGACY_CORE_VERSION, "");
  return `${cleaned.trimEnd()}\n\nconsole.info("[Navimower Map Card] v${version} loaded");\n`;
}
