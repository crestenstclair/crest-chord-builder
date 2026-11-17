import { chordDropIndex } from "./chord-order.js";

const cardSelector = "[data-reorder-chord]";
const gridSelector = "[data-chord-list]";

function nearestCard(grid, x, y) {
  let closest = null;
  let distance = Infinity;
  for (const card of grid.querySelectorAll(cardSelector)) {
    const rect = card.getBoundingClientRect();
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const candidate = dx * dx + dy * dy;
    if (candidate < distance) {
      closest = card;
      distance = candidate;
    }
  }
  return closest;
}

// Delegate to the stable app root. A render cancels the gesture, never commits it.
export class ChordReorder {
  constructor(root, onMove) {
    this.root = root;
    this.onMove = onMove;
    this.drag = null;
    this.marker = null;
    this.blockedStart = false;
    root.addEventListener("pointerdown", (event) => {
      this.blockedStart = Boolean(event.target.closest("button,a,input,select,textarea,[contenteditable=true]") && !event.target.closest("[data-reorder-handle]"));
    });
    root.addEventListener("dragstart", (event) => this.start(event));
    root.addEventListener("dragover", (event) => this.preview(event));
    root.addEventListener("drop", (event) => this.drop(event));
    root.addEventListener("dragend", () => this.cancel());
    root.addEventListener("keydown", (event) => this.keyboard(event));
  }

  cancel() {
    this.drag?.card.classList.remove("is-dragging");
    this.marker?.removeAttribute("data-drop-side");
    this.drag = null;
    this.marker = null;
  }

  start(event) {
    const card = event.target.closest(cardSelector);
    if (!card) return;
    const grid = card?.closest(gridSelector);
    if (!grid || this.blockedStart || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    this.cancel();
    this.drag = { card, grid, chordId: card.dataset.reorderChord, partId: grid.dataset.chordList };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-crest-chord", this.drag.chordId);
    card.classList.add("is-dragging");
  }

  dropTarget(event) {
    if (!this.drag?.grid.isConnected || event.target.closest(gridSelector) !== this.drag.grid) return null;
    const card = event.target.closest(cardSelector) ?? nearestCard(this.drag.grid, event.clientX, event.clientY);
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    return { card, after: event.clientX >= rect.left + rect.width / 2 };
  }

  preview(event) {
    const target = this.dropTarget(event);
    this.marker?.removeAttribute("data-drop-side");
    this.marker = null;
    if (!target) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    if (target.card === this.drag.card) return;
    target.card.dataset.dropSide = target.after ? "after" : "before";
    this.marker = target.card;
  }

  drop(event) {
    const target = this.dropTarget(event);
    if (!target) return this.cancel();
    event.preventDefault();
    const { chordId, partId, grid, card } = this.drag;
    const cards = [...grid.querySelectorAll(cardSelector)];
    const destination = target.card === card ? cards.indexOf(card)
      : chordDropIndex(cards.indexOf(card), cards.indexOf(target.card), target.after);
    this.cancel();
    if (this.onMove({ chordId, partId, destination })) this.focus(chordId);
  }

  focus(chordId) {
    this.root.querySelector(`[data-reorder-handle="${CSS.escape(chordId)}"]`)?.focus({ preventScroll: true });
  }

  keyboard(event) {
    const handle = event.target.closest("[data-reorder-handle]");
    const grid = handle?.closest(gridSelector);
    if (!grid || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const cards = [...grid.querySelectorAll(cardSelector)];
    const source = cards.indexOf(handle.closest(cardSelector));
    const destination = event.key === "Home" ? 0 : event.key === "End" ? cards.length - 1
      : source + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
    const chordId = handle.dataset.reorderHandle;
    if (this.onMove({ chordId, partId: grid.dataset.chordList, destination })) this.focus(chordId);
  }
}
