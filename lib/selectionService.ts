/**
 * lib/selectionService.ts - Section 15's "Selection Service".
 *
 * The actual selection-detection logic (is there a selection, is it
 * inside our reading container, which section does it belong to) was
 * duplicated between HighlightToolbar.tsx and DefinitionPopover.tsx
 * before this existed - one component owns the highlight-to-ask
 * toolbar's UI, the other owns the definition popover's UI, but both
 * needed the same underlying "what did the student select and where" data.
 * This is that shared logic, with no UI of its own.
 */

export interface ContainerSelection {
  text: string;
  sectionIndex: number;
  rect: DOMRect;
}

/** Reads the current window selection, returns null unless it's a
 * non-empty selection anchored inside `container` and inside an element
 * carrying data-section-index. */
export function getContainerSelection(container: HTMLElement | null): ContainerSelection | null {
  if (!container) return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;

  const text = sel.toString().trim();
  if (!text) return null;

  const anchorNode = sel.anchorNode;
  if (!anchorNode || !container.contains(anchorNode)) return null;

  const sectionEl = (anchorNode instanceof Element ? anchorNode : anchorNode.parentElement)?.closest<HTMLElement>(
    "[data-section-index]"
  );
  if (!sectionEl) return null;
  const sectionIndex = Number(sectionEl.dataset.sectionIndex);

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  return { text, sectionIndex, rect };
}

/** True for a selection with no whitespace - what a double-click produces.
 * Used to divide ownership between the two selection-driven UIs: a
 * single word belongs to DefinitionPopover, anything else belongs to
 * HighlightToolbar. Showing both for the same selection would stack two
 * floating panels on top of each other. */
export function isSingleWordSelection(text: string): boolean {
  return !/\s/.test(text);
}

export function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}
