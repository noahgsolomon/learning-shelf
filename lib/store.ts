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

// ── Avatars ──────────────────────────────────────────────────────────────
// One optional profile photo per author, rendered as a polaroid on their
// board section. Stored as avatars/<author>.<ext>; re-uploading replaces it.

const AVATAR_DIR = join(process.cwd(), ".data", "avatars");
const AVATAR_EXTS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function avatarExtFor(contentType: string): string | undefined {
  return AVATAR_EXTS[contentType];
}

export async function setAvatar(
  author: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const ext = AVATAR_EXTS[contentType];
  if (!ext) throw new Error(`unsupported avatar type ${contentType}`);

  if (usingBlob()) {
    const { put, del } = await import("@vercel/blob");
    // Drop any previous avatar with a different extension first.
    const stale = Object.values(AVATAR_EXTS)
      .filter((e) => e !== ext)
      .map((e) => `avatars/${author}.${e}`);
    await del(stale).catch(() => {});
    await put(`avatars/${author}.${ext}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }

  await mkdir(AVATAR_DIR, { recursive: true });
  const { unlink } = await import("node:fs/promises");
  for (const e of Object.values(AVATAR_EXTS)) {
    if (e !== ext) await unlink(join(AVATAR_DIR, `${author}.${e}`)).catch(() => {});
  }
  await writeFile(join(AVATAR_DIR, `${author}.${ext}`), bytes);
}

export async function getAvatar(
  author: string,
): Promise<{ bytes: Buffer; contentType: string } | undefined> {
  if (usingBlob()) {
    const { head } = await import("@vercel/blob");
    for (const [type, ext] of Object.entries(AVATAR_EXTS)) {
      try {
        const blob = await head(`avatars/${author}.${ext}`);
        const res = await fetch(blob.url, { cache: "no-store" });
        return { bytes: Buffer.from(await res.arrayBuffer()), contentType: type };
      } catch {
        // try the next extension
      }
    }
    return undefined;
  }

  try {
    const files = await readdir(AVATAR_DIR);
    const file = files.find((f) => f.startsWith(`${author}.`));
    if (!file) return undefined;
    const ext = file.split(".").pop() ?? "";
    const contentType = EXT_TYPES[ext];
    if (!contentType) return undefined;
    return { bytes: await readFile(join(AVATAR_DIR, file)), contentType };
  } catch {
    return undefined;
  }
}

// Which authors have an avatar — one cheap call for the whole board.
export async function listAvatarAuthors(): Promise<Set<string>> {
  if (usingBlob()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "avatars/", limit: 1000 });
    return new Set(
      blobs.map((b) => b.pathname.replace(/^avatars\//, "").replace(/\.\w+$/, "")),
    );
  }

  try {
    const files = await readdir(AVATAR_DIR);
    return new Set(files.map((f) => f.replace(/\.\w+$/, "")));
  } catch {
    return new Set();
  }
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
