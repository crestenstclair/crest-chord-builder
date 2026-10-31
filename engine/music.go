package engine

import (
	"fmt"
	"strconv"
	"strings"
)

// flatNames is the default spelling for pitch classes when the input JSON
// gives no preferred spelling of its own.
var flatNames = [12]string{"C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"}

var noteToPC = map[string]int{
	"C": 0, "B#": 0,
	"C#": 1, "Db": 1,
	"D":  2,
	"D#": 3, "Eb": 3,
	"E": 4, "Fb": 4,
	"F": 5, "E#": 5,
	"F#": 6, "Gb": 6,
	"G":  7,
	"G#": 8, "Ab": 8,
	"A":  9,
	"A#": 10, "Bb": 10,
	"B": 11, "Cb": 11,
}

// parseNoteName parses a bare pitch-class name such as "D", "Bb" or "F#".
func parseNoteName(s string) (int, error) {
	pc, ok := noteToPC[normalizeNote(s)]
	if !ok {
		return 0, fmt.Errorf("unknown note name %q", s)
	}
	return pc, nil
}

// parsePitched parses a note with an octave, such as "D2", and returns its
// pitch class and MIDI number (D2 = 38, middle C = C4 = 60).
func parsePitched(s string) (pc, midi int, err error) {
	trimmed := strings.TrimSpace(s)
	split := len(trimmed)
	for split > 0 && (trimmed[split-1] >= '0' && trimmed[split-1] <= '9' || trimmed[split-1] == '-') {
		split--
	}
	if split == len(trimmed) {
		return 0, 0, fmt.Errorf("tuning note %q is missing an octave (write it like \"D2\")", s)
	}
	pc, err = parseNoteName(trimmed[:split])
	if err != nil {
		return 0, 0, err
	}
	octave, err := strconv.Atoi(trimmed[split:])
	if err != nil {
		return 0, 0, fmt.Errorf("tuning note %q has an invalid octave", s)
	}
	return pc, (octave+1)*12 + pc, nil
}

func normalizeNote(s string) string {
	trimmed := strings.TrimSpace(s)
	trimmed = strings.ReplaceAll(trimmed, "♭", "b")
	trimmed = strings.ReplaceAll(trimmed, "♯", "#")
	if trimmed == "" {
		return trimmed
	}
	return strings.ToUpper(trimmed[:1]) + trimmed[1:]
}

// spelling maps pitch classes to the display names used by the input JSON so
// generated output reuses the author's spelling (e.g. "Eb" stays "Eb", never "D#").
type spelling map[int]string

func newSpelling(noteNames []string) spelling {
	spell := spelling{}
	for _, name := range noteNames {
		if pc, err := parseNoteName(name); err == nil {
			if _, exists := spell[pc]; !exists {
				spell[pc] = normalizeNote(name)
			}
		}
	}
	return spell
}

func (s spelling) name(pc int) string {
	if name, ok := s[pc]; ok {
		return name
	}
	return flatNames[((pc%12)+12)%12]
}
