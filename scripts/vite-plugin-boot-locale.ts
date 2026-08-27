import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

/**
 * Top-level groups of the English catalog that the signed-out boot surface
 * (login/registration, toasts, shared error strings) actually renders. Only
 * these are bundled into the entry; the full catalog is merged in lazily
 * right after boot (see src/ui/i18n/i18n.ts).
 */
const BOOT_LOCALE_GROUPS = ["common", "auth", "errors", "messages"];

const VIRTUAL_ID = "virtual:termix-boot-locale";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * Serves `virtual:termix-boot-locale`: the boot-critical subset of
 * src/ui/locales/en.json. Keeping this a virtual module means the subset can
 * never drift from the real catalog and no generated file has to be checked
 * in.
 */
export function bootLocalePlugin(): Plugin {
  return {
    name: "termix-boot-locale",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const localePath = path.resolve(
        __dirname,
        "..",
        "src",
        "ui",
        "locales",
        "en.json",
      );
      const full = JSON.parse(fs.readFileSync(localePath, "utf8")) as Record<
        string,
        unknown
      >;
      const subset: Record<string, unknown> = {};
      for (const group of BOOT_LOCALE_GROUPS) {
        if (full[group] !== undefined) subset[group] = full[group];
      }
      this.addWatchFile(localePath);
      return `export default ${JSON.stringify(subset)};`;
    },
  };
}
