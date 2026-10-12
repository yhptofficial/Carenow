/**
 * Resolver hook: lets Node import the app's extensionless relative specifiers.
 *
 * `import { x } from "./db"` is what Next.js expects; Node's ESM resolver
 * requires a full filename. This adds the `.ts`/`.tsx` extension when the
 * specifier has none, and does nothing else.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    for (const ext of [".ts", ".tsx", ".js"]) {
      try {
        const candidate = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) {
          return next(specifier + ext, context);
        }
      } catch {
        // Fall through to the default resolution below.
      }
    }
  }
  return next(specifier, context);
}
