// Return a reordered copy without changing chord objects or a no-op's array identity.
export function reorderChords(chords, chordId, destination) {
  const source = chords.findIndex((chord) => chord.id === chordId);
  if (source < 0 || !Number.isInteger(destination) || destination < 0 || destination >= chords.length || source === destination)
    return chords;
  const next = [...chords];
  const [chord] = next.splice(source, 1);
  next.splice(destination, 0, chord);
  return next;
}

// Convert an insertion edge in the original list into an index after removal.
export function chordDropIndex(source, target, after) {
  const insertion = target + (after ? 1 : 0);
  return insertion > source ? insertion - 1 : insertion;
}
