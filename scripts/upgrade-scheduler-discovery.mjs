import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src", "navimower-map-card.js");
let source = await readFile(sourcePath, "utf8");

const marker = "// 0.3.4-beta10: resilient Navimower scheduler discovery.";
if (source.includes(marker)) {
  console.log("Scheduler discovery upgrade already applied");
  process.exit(0);
}

if (!source.includes("0.3.4-beta6: schedule source selection, custom queue editing and inline settings controls.")) {
  throw new Error("Expected beta6 scheduler runtime hook was not found");
}

const patch = String.raw`

// 0.3.4-beta10: resilient Navimower scheduler discovery.
(() => {
  const Card = globalThis.customElements?.get?.("navimower-map-card");
  if (!Card || Card.__navimower034Beta10Patched) return;
  Card.__navimower034Beta10Patched = true;

  const proto = Card.prototype;
  const CACHE_TTL_MS = 30000;

  const state = (card, entityId) => entityId ? card?._hass?.states?.[entityId] : null;
  const activeEntries = (registry) => registry.filter((entry) => !entry?.disabled_by);
  const hasSuffix = (entry, suffix) => {
    const entityId = String(entry?.entity_id || "");
    const uniqueId = String(entry?.unique_id || "");
    return entityId.endsWith(suffix) || uniqueId.endsWith(suffix);
  };
  const findEntity = (entries, domain, suffix) => entries.find((entry) =>
    String(entry?.entity_id || "").startsWith(domain + ".") && hasSuffix(entry, suffix)
  ) || null;

  function apiEntryId(card) {
    let path = null;
    try {
      path = typeof card?._apiPath === "function" ? card._apiPath() : null;
    } catch (_error) {
      path = null;
    }
    const match = String(path || "").match(/\/api\/navimower\/map\/([^/?#]+)/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch (_error) {
      return match[1];
    }
  }

  function cacheKey(card) {
    const mower = typeof card?._mowerEntity === "function"
      ? card._mowerEntity()
      : card?._resolved?.mower_entity || card?._config?.entity || null;
    return [
      apiEntryId(card) || "",
      card?._resolved?.map_entity || card?._config?.map_entity || "",
      mower || "",
    ].join("|");
  }

  function clearDiscovery(card) {
    card._beta10SchedulerEntities = null;
    card._beta10ScheduleDeviceId = null;
    card._beta6SchedulerEntities = null;
    card._beta5SchedulerEntities = null;
  }

  function syncLegacyCaches(card, result) {
    const legacy = {
      status: result.status || null,
      managedSwitch: result.managedSwitch || null,
      nativeSwitch: result.nativeSwitch || null,
      start: result.start || null,
      end: result.end || null,
    };
    card._beta6SchedulerEntities = legacy;
    card._beta5SchedulerEntities = legacy;
    card._beta10ScheduleDeviceId = result.deviceId || null;
  }

  async function discover(card, options = {}) {
    const key = cacheKey(card);
    const cached = card._beta10SchedulerEntities;
    const now = Date.now();
    if (
      !options.force &&
      cached?.status &&
      cached._cacheKey === key &&
      now - Number(cached._discoveredAt || 0) < CACHE_TTL_MS &&
      state(card, cached.status)
    ) {
      syncLegacyCaches(card, cached);
      return cached;
    }

    if (!card?._hass?.callWS) {
      return { status: null, managedSwitch: null, nativeSwitch: null, start: null, end: null };
    }

    let registry;
    try {
      registry = await card._hass.callWS({ type: "config/entity_registry/list" });
    } catch (error) {
      console.debug("[Navimower Map Card] beta10 scheduler discovery failed", error);
      clearDiscovery(card);
      return { status: null, managedSwitch: null, nativeSwitch: null, start: null, end: null };
    }
    if (!Array.isArray(registry)) {
      clearDiscovery(card);
      return { status: null, managedSwitch: null, nativeSwitch: null, start: null, end: null };
    }

    const entries = activeEntries(registry);
    const mower = typeof card._mowerEntity === "function"
      ? card._mowerEntity()
      : card?._resolved?.mower_entity || card?._config?.entity || null;
    const mapEntityId = card?._resolved?.map_entity || card?._config?.map_entity || null;
    const mowerEntry = entries.find((entry) => entry.entity_id === mower) || null;
    const mapEntry = entries.find((entry) => entry.entity_id === mapEntityId) || null;
    const entryId = apiEntryId(card);

    const scopes = [];
    const seenScopes = new Set();
    const addScope = (name, values) => {
      if (!values.length) return;
      const signature = values.map((entry) => entry.entity_id).sort().join("|");
      if (!signature || seenScopes.has(signature)) return;
      seenScopes.add(signature);
      scopes.push({ name, values });
    };

    if (entryId) {
      addScope("map_api_config_entry", entries.filter((entry) => entry.config_entry_id === entryId));
    }
    if (mapEntry?.config_entry_id) {
      addScope("map_config_entry", entries.filter((entry) => entry.config_entry_id === mapEntry.config_entry_id));
    }
    if (mapEntry?.device_id) {
      addScope("map_device", entries.filter((entry) => entry.device_id === mapEntry.device_id));
    }
    if (mowerEntry?.config_entry_id) {
      addScope("mower_config_entry", entries.filter((entry) => entry.config_entry_id === mowerEntry.config_entry_id));
    }
    if (mowerEntry?.device_id) {
      addScope("mower_device", entries.filter((entry) => entry.device_id === mowerEntry.device_id));
    }

    const uniqueCandidates = [mapEntry?.unique_id, mowerEntry?.unique_id]
      .map((value) => String(value || ""))
      .filter(Boolean);
    for (const uniqueId of uniqueCandidates) {
      const prefix = uniqueId.replace(/_(?:map_data|mower)$/, "_");
      if (prefix && prefix !== uniqueId) {
        addScope("unique_id_prefix", entries.filter((entry) => String(entry.unique_id || "").startsWith(prefix)));
      }
    }

    let statusEntry = null;
    let matchedScope = null;
    for (const scope of scopes) {
      statusEntry = findEntity(scope.values, "sensor", "navimower_schedule_status");
      if (statusEntry) {
        matchedScope = scope;
        break;
      }
    }

    if (!statusEntry) {
      const globalStatuses = entries.filter((entry) =>
        String(entry.entity_id || "").startsWith("sensor.") &&
        hasSuffix(entry, "navimower_schedule_status")
      );
      if (globalStatuses.length === 1) {
        statusEntry = globalStatuses[0];
        matchedScope = { name: "single_global_status", values: entries };
      }
    }

    if (!statusEntry) {
      clearDiscovery(card);
      return { status: null, managedSwitch: null, nativeSwitch: null, start: null, end: null };
    }

    let family = matchedScope?.values || entries;
    if (statusEntry.config_entry_id) {
      family = entries.filter((entry) => entry.config_entry_id === statusEntry.config_entry_id);
    } else if (statusEntry.device_id) {
      family = entries.filter((entry) => entry.device_id === statusEntry.device_id);
    }

    let nativeSwitch = findEntity(family, "switch", "mowing_schedule_enabled")?.entity_id || null;
    if (!nativeSwitch && typeof card._scheduleSwitchEntity === "function") {
      nativeSwitch = card._scheduleSwitchEntity() || null;
    }

    const result = {
      status: statusEntry.entity_id,
      managedSwitch: findEntity(family, "switch", "navimower_schedule")?.entity_id || null,
      nativeSwitch,
      start: findEntity(family, "time", "navimower_schedule_start")?.entity_id || null,
      end: findEntity(family, "time", "navimower_schedule_end")?.entity_id || null,
      deviceId: statusEntry.device_id || null,
      configEntryId: statusEntry.config_entry_id || entryId || null,
      source: matchedScope?.name || "unknown",
      _cacheKey: key,
      _discoveredAt: now,
    };

    card._beta10SchedulerEntities = result;
    syncLegacyCaches(card, result);
    return result;
  }

  proto._discoverNavimowerSchedulerEntities = function (options) {
    return discover(this, options);
  };

  const previousSetConfig = proto.setConfig;
  if (typeof previousSetConfig === "function") {
    proto.setConfig = function schedulerDiscoverySetConfig(config) {
      const result = previousSetConfig.call(this, config);
      clearDiscovery(this);
      return result;
    };
  }

  const previousMowerDeviceId = proto._mowerDeviceId;
  if (typeof previousMowerDeviceId === "function") {
    proto._mowerDeviceId = function schedulerAwareMowerDeviceId(...args) {
      if (this._beta6ManagedOpen && this._beta10ScheduleDeviceId) {
        return this._beta10ScheduleDeviceId;
      }
      return previousMowerDeviceId.apply(this, args);
    };
  }

  const previousOpenSchedule = proto._openScheduleDialog;
  proto._openScheduleDialog = async function resilientScheduleOpen(...args) {
    const mode = this._config?.schedule_view_mode || "auto";
    if (mode === "native") {
      this._beta10ScheduleDeviceId = null;
      return previousOpenSchedule?.apply(this, args);
    }

    const ids = await discover(this);
    const statusState = state(this, ids.status);
    const enabledAttribute = statusState?.attributes?.enabled;
    const managedOn = typeof enabledAttribute === "boolean"
      ? enabledAttribute
      : String(state(this, ids.managedSwitch)?.state || "").toLowerCase() === "on";

    this._beta6SettingsOpen = false;
    this._beta5SettingsOpen = false;
    if (ids.status && (mode === "navimower" || (mode === "auto" && managedOn))) {
      this._beta5ManagedScheduleOpen = false;
      this._scheduleDialogOpen = false;
      this._mowDialogOpen = false;
      this._notificationDialogOpen = false;
      this._beta6ManagedOpen = true;
      this._renderDialog();
      return;
    }

    this._beta6ManagedOpen = false;
    return previousOpenSchedule?.apply(this, args);
  };

  console.info("[Navimower Map Card] 0.3.4-beta10 resilient scheduler discovery enabled");
})();
`;

source += patch;
await writeFile(sourcePath, source, "utf8");
console.log("Applied resilient scheduler discovery upgrade");
