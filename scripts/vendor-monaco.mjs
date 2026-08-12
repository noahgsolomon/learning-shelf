// Copy Monaco's AMD build into public/ so the dojo can serve it same-origin.
//
// Why vendored and not imported: the dojo runtime is a plain static script with
// no bundler, and the whole point of serving it ourselves is that a published
// doc never reaches out to a CDN. Monaco's `min/vs` AMD build loads perfectly
// from a static directory, so we copy it there.
//
// Why generated and not committed: it's ~24MB. It's gitignored and rebuilt by
// `predev` / `prebuild`, which means Vercel produces it during the deploy build
// (devDependencies are installed there) and git stays clean.
//
//   node scripts/vendor-monaco.mjs [--force]

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const target = join(root, "public", "dojo", "vs");
const stamp = join(root, "public", "dojo", ".monaco-version");

// Located by path rather than require.resolve: monaco-editor's `exports` map
// deliberately refuses to hand out its own package.json, so asking politely
// throws MODULE_NOT_FOUND.
const pkgDir = join(root, "node_modules", "monaco-editor");
const pkgPath = join(pkgDir, "package.json");
if (!(await stat(pkgPath).catch(() => null))) {
  console.error(
    `monaco-editor is not installed at ${pkgDir}\n` +
      `run \`npm install\` first — it's a devDependency`,
  );
  process.exit(1);
}
const version = JSON.parse(await readFile(pkgPath, "utf-8")).version;
const source = join(pkgDir, "min", "vs");

const force = process.argv.includes("--force");

// Skip the copy when the vendored tree already matches the installed version —
// this runs before every dev start, and 24MB of file copying on each one would
// be a tax for nothing.
if (!force && (await readFile(stamp, "utf-8").catch(() => "")) === version) {
  console.log(`monaco ${version} already vendored at public/dojo/vs`);
  process.exit(0);
}

if (!(await stat(source).catch(() => null))) {
  console.error(
    `could not find monaco's AMD build at ${source}\n` +
      `run \`npm install\` first — monaco-editor is a devDependency`,
  );
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
await writeFile(stamp, version, "utf-8");

console.log(`vendored monaco ${version} → public/dojo/vs`);
