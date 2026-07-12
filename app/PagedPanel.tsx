"use client";

// One member's corner, paginated: a prolific author's paper shows a page of
// docs at a time instead of stretching the whole board, with a handwritten
// pager scribbled at the bottom of their panel. Newest docs are page 1.

import { useState } from "react";
import { AuthorPanel, type AuthorGroup } from "@/lib/sections";

const PER_PAGE = 4;

const ink = "#2D2A26";
const script = "'Caveat', cursive";

export function PagedPanel({ group }: { group: AuthorGroup }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(group.docs.length / PER_PAGE));

  if (pages === 1) {
    return <AuthorPanel group={group} />;
  }

  const sliced: AuthorGroup = {
    ...group,
    docs: group.docs.slice(page * PER_PAGE, (page + 1) * PER_PAGE),
    total: group.docs.length,
  };

  return (
    <>
      <AuthorPanel group={sliced} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          marginTop: "12px",
          fontFamily: script,
          fontWeight: 700,
          fontSize: "20px",
          color: "#4A4139",
        }}
      >
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          style={arrow(page === 0)}
        >
          ← newer
        </button>
        <span>
          page {page + 1} of {pages} · {group.docs.length} notes
        </span>
        <button
          onClick={() => setPage(Math.min(pages - 1, page + 1))}
          disabled={page === pages - 1}
          style={arrow(page === pages - 1)}
        >
          older →
        </button>
      </div>
    </>
  );
}

function arrow(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: script,
    fontWeight: 700,
    fontSize: "20px",
    color: ink,
    background: "none",
    border: "none",
    padding: "2px 6px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
  };
}
