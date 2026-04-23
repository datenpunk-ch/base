import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DE_PATH = path.join(ROOT, "content", "de.json");
const EN_PATH = path.join(ROOT, "content", "en.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function todoTranslate(deString) {
  const s = String(deString ?? "");
  if (!s.trim()) return "";
  // Keep it obvious in UI until translated properly.
  return `[TODO translate] ${s}`;
}

function looksLikeIdObjectArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every((x) => isPlainObject(x) && typeof x.id === "string");
}

function syncValue(deVal, enVal, report, keyPath) {
  // Preserve numbers/booleans/null as-is from DE when EN is missing.
  if (typeof deVal === "string") {
    if (typeof enVal === "string") return enVal;
    report.missing.push(keyPath);
    return todoTranslate(deVal);
  }

  if (typeof deVal === "number") {
    if (typeof enVal === "number") return enVal;
    report.missing.push(keyPath);
    return deVal;
  }

  if (typeof deVal === "boolean") {
    if (typeof enVal === "boolean") return enVal;
    report.missing.push(keyPath);
    return deVal;
  }

  if (deVal == null) {
    if (enVal == null) return enVal;
    report.missing.push(keyPath);
    return deVal;
  }

  if (Array.isArray(deVal)) {
    if (!Array.isArray(enVal)) {
      report.missing.push(keyPath);
      enVal = [];
    }

    // Special case: arrays of objects with stable `id` keys (like projects).
    if (looksLikeIdObjectArray(deVal)) {
      const enById = new Map(
        enVal
          .filter((x) => isPlainObject(x) && typeof x.id === "string")
          .map((x) => [x.id, x])
      );

      return deVal.map((deItem, i) => {
        const id = deItem.id;
        const enItem = enById.get(id);
        const p = `${keyPath}[id=${id}]`;
        return syncValue(deItem, enItem, report, p);
      });
    }

    // Default: sync by index.
    return deVal.map((deItem, i) => {
      const enItem = Array.isArray(enVal) ? enVal[i] : undefined;
      return syncValue(deItem, enItem, report, `${keyPath}[${i}]`);
    });
  }

  if (isPlainObject(deVal)) {
    const out = {};
    const enObj = isPlainObject(enVal) ? enVal : {};

    for (const k of Object.keys(deVal)) {
      const nextPath = keyPath ? `${keyPath}.${k}` : k;
      out[k] = syncValue(deVal[k], enObj[k], report, nextPath);
    }

    // Drop extra EN-only keys (keeps schemas aligned).
    return out;
  }

  // Unknown type (shouldn't happen in your content): keep EN if same type else DE.
  if (typeof enVal === typeof deVal) return enVal;
  report.missing.push(keyPath);
  return deVal;
}

function main() {
  const de = readJson(DE_PATH);
  const en = readJson(EN_PATH);

  const report = { missing: [] };
  const nextEn = syncValue(de, en, report, "");

  writeJson(EN_PATH, nextEn);

  const uniq = Array.from(new Set(report.missing)).filter(Boolean).sort();
  if (uniq.length) {
    console.log(`Updated en.json. Missing translations: ${uniq.length}`);
    console.log(uniq.map((p) => `- ${p}`).join("\n"));
    process.exitCode = 2;
  } else {
    console.log("en.json already had all keys (or was updated without new TODOs).");
  }
}

main();

