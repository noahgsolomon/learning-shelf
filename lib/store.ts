// One tiny storage interface, two backends. On Vercel (BLOB_READ_WRITE_TOKEN
// present) docs live in Vercel Blob; locally they live in .data/ on disk.
// Each doc is two objects: <slug>.html (the document itself, served verbatim)
// and <slug>.meta.json (what the directory page lists).

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type DocMeta = {
  slug: string;
  title: string;
  subject: string; // what is actually being learned ("Ceramics", "Next.js internals")
  description: string; // one or two sentences for the directory card
  author: string;
  template: string; // the template the DOC itself uses (per doc)
  authorStyle: string; // the design language of the author's directory band
  // Progress through the topic's modules. A topic is broken into a planned set
  // of modules, taught one at a time; modulesDone / modulesTotal is how far in
  // the learner is. currentModule names the one being worked now. Zero total
  // means progress isn't tracked for this doc.
  modulesDone: number;
  modulesTotal: number;
  currentModule: string;
  updatedAt: string; // ISO
};

const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const DATA_DIR = join(process.cwd(), ".data", "docs");

export async function publishDoc(
  meta: Omit<DocMeta, "updatedAt">,
  html: string,
): Promise<DocMeta> {
  const full: DocMeta = { ...meta, updatedAt: new Date().toISOString() };

  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    await put(`docs/${meta.slug}.html`, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    await put(`docs/${meta.slug}.meta.json`, JSON.stringify(full), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return full;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, `${meta.slug}.html`), html, "utf-8");
  await writeFile(
    join(DATA_DIR, `${meta.slug}.meta.json`),
    JSON.stringify(full),
    "utf-8",
  );
  return full;
}

export async function listDocs(): Promise<DocMeta[]> {
  let metas: DocMeta[] = [];

  if (usingBlob()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "docs/", limit: 1000 });
    const metaBlobs = blobs.filter((b) => b.pathname.endsWith(".meta.json"));
    metas = await Promise.all(
      metaBlobs.map(async (b) => {
        const res = await fetch(b.url, { cache: "no-store" });
        return (await res.json()) as DocMeta;
      }),
    );
  } else {
    try {
      const files = await readdir(DATA_DIR);
      metas = await Promise.all(
        files
          .filter((f) => f.endsWith(".meta.json"))
          .map(async (f) =>
            JSON.parse(await readFile(join(DATA_DIR, f), "utf-8")),
          ),
      );
    } catch {
      metas = [];
    }
  }

  // Tolerate docs published before newer meta fields existed.
  for (const m of metas) {
    if (!m.authorStyle) m.authorStyle = "plain";
    if (!m.subject) m.subject = m.title;
    if (!m.description) m.description = "";
    if (typeof m.modulesDone !== "number") m.modulesDone = 0;
    if (typeof m.modulesTotal !== "number") m.modulesTotal = 0;
    if (!m.currentModule) m.currentModule = "";
  }

  return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteDoc(slug: string): Promise<void> {
  if (usingBlob()) {
    const { del } = await import("@vercel/blob");
    await del([`docs/${slug}.html`, `docs/${slug}.meta.json`]).catch(() => {});
    return;
  }

  const { unlink } = await import("node:fs/promises");
  await unlink(join(DATA_DIR, `${slug}.html`)).catch(() => {});
  await unlink(join(DATA_DIR, `${slug}.meta.json`)).catch(() => {});
}

export async function getDocHtml(slug: string): Promise<string | undefined> {
  if (usingBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const blob = await head(`docs/${slug}.html`);
      const res = await fetch(blob.url, { cache: "no-store" });
      return await res.text();
    } catch {
      return undefined;
    }
  }

  try {
    return await readFile(join(DATA_DIR, `${slug}.html`), "utf-8");
  } catch {
    return undefined;
  }
}
