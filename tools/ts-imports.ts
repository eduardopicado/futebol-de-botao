/* Lets node run a tool straight from its TypeScript (--experimental-strip-types)
 * when what it imports from src/ imports its neighbours the way the app does,
 * with no extension: such an import is tried again as a .ts file.
 *
 *   node --experimental-strip-types --import ./tools/ts-imports.ts tools/make-audio.ts */

import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (!/^\.{1,2}\//.test(specifier) || /\.[a-z]+$/i.test(specifier)) throw err;
      return next(`${specifier}.ts`, context);
    }
  },
});
