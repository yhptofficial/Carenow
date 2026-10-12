/**
 * Test bootstrap.
 *
 * Two jobs, both so the tests can drive the *real* app modules rather than a
 * copy of them:
 *
 *  1. Resolve extensionless relative imports (`./db` → `./db.ts`). Next.js does
 *     this for the app; Node's ESM resolver does not.
 *  2. Provide a minimal `window.localStorage`, because the local data adapter
 *     persists there.
 *
 * Node 22 strips TypeScript types on import natively, so no compiler is needed.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-resolve.mjs", pathToFileURL(import.meta.filename));

/* ---- Browser shims ------------------------------------------------------- */

class MemoryStorage {
  #map = new Map();
  get length() {
    return this.#map.size;
  }
  clear() {
    this.#map.clear();
  }
  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }
  setItem(key, value) {
    this.#map.set(key, String(value));
  }
  removeItem(key) {
    this.#map.delete(key);
  }
  key(i) {
    return [...this.#map.keys()][i] ?? null;
  }
}

const localStorage = new MemoryStorage();

globalThis.localStorage = localStorage;
globalThis.window = globalThis.window ?? { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.window.localStorage = localStorage;
