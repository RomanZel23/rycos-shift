/**
 * Rozwiązywanie ścieżek dla `node --test`.
 *
 * Node 22 zdejmuje adnotacje typów sam, ale jego resolver ESM wymaga pełnych
 * rozszerzeń i nie zna aliasu `@/`, którym posługuje się bundler Next.
 * Te dwie reguły wystarczą, żeby testy importowały pliki ze `src/` bez zmian
 * w kodzie produkcyjnym i bez dokładania paczek do projektu.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Dokłada .ts/.tsx, jeśli plik bez rozszerzenia nie istnieje. */
function withExtension(fileUrl) {
  const path = fileURLToPath(fileUrl);
  if (existsSync(path)) return fileUrl;
  for (const candidate of [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return fileUrl;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const mapped = pathToFileURL(resolvePath(SRC, specifier.slice(2))).href;
      return { url: withExtension(mapped), shortCircuit: true };
    }
    if (specifier.startsWith(".")) {
      const parentPath = context.parentURL
        ? dirname(fileURLToPath(context.parentURL))
        : process.cwd();
      const mapped = pathToFileURL(resolvePath(parentPath, specifier)).href;
      const withExt = withExtension(mapped);
      if (withExt !== mapped) return { url: withExt, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
