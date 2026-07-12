// One tiny storage interface, two backends. On Vercel (BLOB_READ_WRITE_TOKEN
// present) docs live in Vercel Blob; locally they live in .data/ on disk.
// Each doc is two objects: <slug>.html (the document itself, served verbatim)
// and <slug>.meta.json (what the directory page lists).

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type DocMeta = {
  slug: string;
  title: string;
  author: string;
  template: string; // the template the DOC itself uses (per doc)
  authorStyle: string; // the design language of the author's directory band
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

  // Tolerate docs published before authorStyle existed.
  for (const m of metas) {
    if (!m.authorStyle) m.authorStyle = "plain";
  }

  return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
