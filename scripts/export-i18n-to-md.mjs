import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isRenderableValue(val) {
  return typeof val === "string" || typeof val === "number";
}

function* walkLeaves(obj, prefix = "") {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const next = prefix ? `${prefix}[${i}]` : `[${i}]`;
      yield* walkLeaves(obj[i], next);
    }
    return;
  }

  if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      const next = prefix ? `${prefix}.${k}` : k;
      yield* walkLeaves(obj[k], next);
    }
    return;
  }

  if (isRenderableValue(obj)) {
    yield [prefix, String(obj)];
  }
}

function toMd(locale, bundle) {
  const lines = [];
  lines.push(`---`);
  lines.push(`locale: ${locale}`);
  lines.push(`source: content/${locale}.json`);
  lines.push(`note: "Edit values below; keys are stable."`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# ${locale} copy`);
  lines.push(``);

  for (const [key, value] of walkLeaves(bundle)) {
    lines.push(`## \`${key}\``);
    lines.push(``);

    // Multiline gets code fence so newlines are preserved.
    if (value.includes("\n")) {
      lines.push("```text");
      lines.push(value);
      lines.push("```");
    } else {
      lines.push(value);
    }

    lines.push(``);
  }

  return lines.join("\n");
}

function writeFile(p, content) {
  fs.writeFileSync(p, content, "utf8");
}

function main() {
  const locales = ["de", "en"];
  for (const locale of locales) {
    const jsonPath = path.join(ROOT, "content", `${locale}.json`);
    const outPath = path.join(ROOT, "content", `copy.${locale}.md`);
    const bundle = readJson(jsonPath);
    writeFile(outPath, toMd(locale, bundle));
    console.log(`Wrote ${path.relative(ROOT, outPath)}`);
  }
}

main();

