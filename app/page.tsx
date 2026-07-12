// The directory: a stacked zine, one band per contributor, each rendered in
// that person's own template aesthetic (baked into their skill as authorStyle).

import { listDocs, type DocMeta } from "@/lib/store";
import { AuthorBand, GlobalHeader, type AuthorGroup } from "@/lib/sections";

export const dynamic = "force-dynamic";

export default async function ShelfPage() {
  const docs = await listDocs();
  const groups = groupByAuthor(docs);

  return (
    <main style={{ minHeight: "100vh" }}>
      <GlobalHeader count={docs.length} />

      {groups.length === 0 ? (
        <p style={{ padding: "48px clamp(28px,6vw,96px)", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "17px" }}>
          Nothing on the shelf yet. Publish the first doc with the shelf skill.
        </p>
      ) : (
        groups.map((group) => <AuthorBand key={group.author} group={group} />)
      )}

      <footer style={{ background: "#fff", padding: "22px clamp(28px,6vw,96px)", fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: "12px", letterSpacing: "0.04em", color: "#555" }}>
        contribute: ask your claude — it has the shelf skill, your name, and your band&apos;s design baked in.
      </footer>
    </main>
  );
}

// Group docs by author (case-insensitive). Each author's band style is the
// authorStyle of their most recently updated doc; authors are ordered by that
// same recency, so the freshest contributor sits on top.
function groupByAuthor(docs: DocMeta[]): AuthorGroup[] {
  const map = new Map<string, DocMeta[]>();

  for (const doc of docs) {
    const key = doc.author.trim().toLowerCase();
    const bucket = map.get(key) ?? [];
    bucket.push(doc);
    map.set(key, bucket);
  }

  const groups: AuthorGroup[] = [...map.values()].map((bucket) => {
    const sorted = [...bucket].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return {
      author: sorted[0].author,
      authorStyle: sorted[0].authorStyle,
      docs: sorted,
    };
  });

  return groups.sort((a, b) =>
    b.docs[0].updatedAt.localeCompare(a.docs[0].updatedAt),
  );
}
