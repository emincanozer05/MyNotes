/**
 * Groups the text nodes of a note into translation units. Text pasted from a
 * PDF arrives broken at every visual line (separated by <br> or one <p> per
 * line), and translating each fragment alone cuts sentences in half. A node
 * continues the previous one when that one ends mid-sentence and the next
 * does not start a new sentence; such nodes are translated together.
 */

const SENTENCE_END = /[.!?:;…)"”'’\]]$/;
const SENTENCE_START = /^\p{Lu}\p{Ll}/u;

function continuesSentence(prev: Text, next: Text): boolean {
  const before = prev.data.trimEnd();
  const after = next.data.trimStart();
  if (!before || SENTENCE_END.test(before) || SENTENCE_START.test(after)) return false;

  if (prev.parentNode === next.parentNode) {
    // Only line breaks / blanks may sit between the two fragments.
    for (let s = prev.nextSibling; s && s !== next; s = s.nextSibling) {
      const blank = s.nodeType === Node.TEXT_NODE && !(s as Text).data.trim();
      if (s.nodeName !== "BR" && !blank) return false;
    }
    return true;
  }

  // One paragraph per pasted line.
  const a = prev.parentElement;
  const b = next.parentElement;
  return (
    !!a &&
    !!b &&
    a.nextElementSibling === b &&
    a.tagName === b.tagName &&
    (a.tagName === "P" || a.tagName === "DIV") &&
    a.childNodes.length === 1 &&
    b.childNodes.length === 1
  );
}

export function groupTextNodes(nodes: Text[]): Text[][] {
  const groups: Text[][] = [];
  for (const n of nodes) {
    const last = groups[groups.length - 1];
    if (last && continuesSentence(last[last.length - 1], n)) last.push(n);
    else groups.push([n]);
  }
  return groups;
}

/** The text of one group as a single flowing string (end-of-line hyphens rejoined). */
export function joinGroupText(group: Text[]): string {
  return group.reduce((acc, node, i) => {
    const piece = node.data.replace(/\s+/g, " ").trim();
    if (i === 0) return piece;
    if (/\p{L}-$/u.test(acc) && /^\p{Ll}/u.test(piece)) return acc.slice(0, -1) + piece;
    return `${acc} ${piece}`;
  }, "");
}

/** Puts the translation into the group's first node and drops the other fragments. */
export function applyGroupTranslation(group: Text[], translated: string) {
  const [first, ...rest] = group;
  const lead = first.data.match(/^\s*/)?.[0] ?? "";
  const trail = group[group.length - 1].data.match(/\s*$/)?.[0] ?? "";
  first.data = lead + translated.trim() + trail;

  for (const node of rest) {
    if (node.parentNode === first.parentNode) {
      // Same block: drop the <br>/blanks after the first node, up to this one.
      for (let s = first.nextSibling; s && s !== node; ) {
        const next = s.nextSibling;
        s.parentNode?.removeChild(s);
        s = next;
      }
      node.parentNode?.removeChild(node);
    } else {
      // One paragraph per pasted line: the whole line's block goes.
      node.parentElement?.remove();
    }
  }
}
