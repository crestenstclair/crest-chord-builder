package engine

import (
	"testing"
)

func tuningMidi(t *testing.T, notes ...string) []int {
	t.Helper()
	midi := make([]int, len(notes))
	for i, n := range notes {
		_, m, err := parsePitched(n)
		if err != nil {
			t.Fatalf("parse %q: %v", n, err)
		}
		midi[i] = m
	}
	return midi
}

func standardTuning(t *testing.T) []int {
	return tuningMidi(t, "E2", "A2", "D3", "G3", "B3", "E4")
}

func pcsOf(t *testing.T, names ...string) []int {
	t.Helper()
	pcs := make([]int, len(names))
	for i, n := range names {
		pc, err := parseNoteName(n)
		if err != nil {
			t.Fatalf("parse %q: %v", n, err)
		}
		pcs[i] = pc
	}
	return pcs
}

func TestParsePitched(t *testing.T) {
	cases := []struct {
		in   string
		midi int
	}{
		{"E2", 40}, {"A2", 45}, {"D3", 50}, {"G3", 55}, {"B3", 59}, {"E4", 64},
		{"D2", 38}, {"C4", 60}, {"Bb3", 58}, {"F#2", 42},
	}
	for _, c := range cases {
		_, midi, err := parsePitched(c.in)
		if err != nil {
			t.Fatalf("parsePitched(%q): %v", c.in, err)
		}
		if midi != c.midi {
			t.Errorf("parsePitched(%q) = %d, want %d", c.in, midi, c.midi)
		}
	}
	if _, _, err := parsePitched("D"); err == nil {
		t.Error("parsePitched(\"D\") should fail without an octave")
	}
}

// Every generated voicing must be complete, playable, and root-grounded when
// the score says so.
func TestGeneratedVoicingsAreValid(t *testing.T) {
	open := standardTuning(t)
	spec := chordSpec{
		required: pcsOf(t, "C", "E", "G"),
		all:      pcsOf(t, "C", "E", "G"),
		rootPC:   0,
		bassPC:   -1,
	}
	results := generateVoicings(open, spec, genConfig{MaxFret: 12, SpanFrets: 4, Results: 8})
	if len(results) < 3 {
		t.Fatalf("expected several C major voicings, got %d", len(results))
	}
	for _, cand := range results {
		present := map[int]bool{}
		fretted := 0
		minFret, maxFret := 0, 0
		for s, f := range cand.frets {
			if f < 0 {
				continue
			}
			present[(open[s]+f)%12] = true
			if f >= 1 {
				fretted++
				if minFret == 0 || f < minFret {
					minFret = f
				}
				if f > maxFret {
					maxFret = f
				}
			}
		}
		for _, pc := range spec.required {
			if !present[pc] {
				t.Errorf("voicing %v is missing pitch class %d", cand.frets, pc)
			}
		}
		if maxFret-minFret > 3 {
			t.Errorf("voicing %v spans %d frets", cand.frets, maxFret-minFret)
		}
		fingerCount := 0
		for _, f := range cand.fingers {
			if f > 0 {
				fingerCount++
			}
		}
		if fingerCount > 4 && !cand.barre {
			t.Errorf("voicing %v needs %d fingers without a barre", cand.frets, fingerCount)
		}
	}
}

// The open C major shape (x 3 2 0 1 0) is the canonical ergonomic answer in
// standard tuning; the search must find it.
func TestFindsOpenCMajor(t *testing.T) {
	open := standardTuning(t)
	spec := chordSpec{
		required: pcsOf(t, "C", "E", "G"),
		all:      pcsOf(t, "C", "E", "G"),
		rootPC:   0,
		bassPC:   -1,
	}
	results := generateVoicings(open, spec, genConfig{MaxFret: 12, SpanFrets: 4, Results: 12})
	want := []int{-1, 3, 2, 0, 1, 0}
	for _, cand := range results {
		if shapeKey(cand.frets) == shapeKey(want) {
			return
		}
	}
	t.Errorf("open C major shape not found; got %d shapes, best %v", len(results), results[0].frets)
}

// The example's eight-string setup keeps standard tuning on the upper six
// strings and adds low E and A strings. The search must retain the compact
// open Em9 grip that makes the global D transposition practical.
func TestFindsOpenEm9OnEightStringEStandard(t *testing.T) {
	open := tuningMidi(t, "E1", "A1", "E2", "A2", "D3", "G3", "B3", "E4")
	spec := chordSpec{
		required: pcsOf(t, "E", "G", "D", "F#"),
		all:      pcsOf(t, "E", "G", "B", "D", "F#"),
		rootPC:   4,
		bassPC:   -1,
	}
	results := generateVoicings(open, spec, genConfig{MaxFret: 12, SpanFrets: 4, Results: 8})
	want := []int{0, 2, 2, -1, 0, 0, 0, 0}
	for _, cand := range results {
		if shapeKey(cand.frets) == shapeKey(want) {
			return
		}
	}
	t.Errorf("open eight-string Em9 shape not found; got %d shapes", len(results))
}

func TestShellVoicingInOpenTuning(t *testing.T) {
	open := tuningMidi(t, "D2", "A2", "D3", "G3", "C4", "D4")
	spec := chordSpec{
		required: pcsOf(t, "D", "A", "C"),
		all:      pcsOf(t, "D", "A", "C"),
		rootPC:   2,
		bassPC:   -1,
	}
	results := generateVoicings(open, spec, genConfig{MaxFret: 12, SpanFrets: 4, Results: 4})
	if len(results) == 0 {
		t.Fatal("no voicings found for a D-A-C shell in DADGCD")
	}
	best := results[0]
	bassPC := -1
	for s, f := range best.frets {
		if f >= 0 {
			bassPC = (open[s] + f) % 12
			break
		}
	}
	if bassPC != 2 {
		t.Errorf("best shell voicing %v does not keep D in the bass", best.frets)
	}
}

func TestFingeringBarre(t *testing.T) {
	// F major barre: 1 3 3 2 1 1.
	fingers, count, barreSize, ok := fingering([]int{1, 3, 3, 2, 1, 1})
	if !ok || barreSize != 3 {
		t.Fatalf("F barre should barre 3 strings (ok=%v barreSize=%d)", ok, barreSize)
	}
	if count != 4 {
		t.Errorf("F barre uses %d fingers, want 4", count)
	}
	for _, s := range []int{0, 4, 5} {
		if fingers[s] != 1 {
			t.Errorf("string %d should be barred with finger 1, got %d", s, fingers[s])
		}
	}

	// Five fretted strings with a muted top string cannot barre to four fingers.
	if _, _, _, ok := fingering([]int{1, 3, 3, 2, 1, -1}); ok {
		t.Error("shape with 5 fretted strings and muted top should be rejected")
	}

	// Simple open shape: no barre, ordered fingers.
	fingers, count, barreSize, ok = fingering([]int{-1, 3, 2, 0, 1, 0})
	if !ok || barreSize != 0 || count != 3 {
		t.Fatalf("open C fingering unexpected (ok=%v barreSize=%d count=%d)", ok, barreSize, count)
	}
	if fingers[4] != 1 || fingers[2] != 2 || fingers[1] != 3 {
		t.Errorf("open C fingers = %v, want 3-2-1 pattern", fingers)
	}
}

// Barres are hardest at fret 1 (string tension at the nut, widest frets); the
// identical grip geometry a few frets up must score as easier. F major barred
// at fret 1 vs G major — the same shape — barred at fret 3.
func TestBarrePositionCurve(t *testing.T) {
	open := standardTuning(t)
	fSpec := chordSpec{required: pcsOf(t, "F", "A", "C"), all: pcsOf(t, "F", "A", "C"), rootPC: 5, bassPC: -1}
	gSpec := chordSpec{required: pcsOf(t, "G", "B", "D"), all: pcsOf(t, "G", "B", "D"), rootPC: 7, bassPC: -1}

	fBarre, ok := evaluateShape([]int{1, 3, 3, 2, 1, 1}, open, fSpec)
	if !ok {
		t.Fatal("F barre should be playable")
	}
	gBarre, ok := evaluateShape([]int{3, 5, 5, 4, 3, 3}, open, gSpec)
	if !ok {
		t.Fatal("G barre should be playable")
	}
	if gBarre.score >= fBarre.score {
		t.Errorf("fret-3 barre (%.2f) should score easier than fret-1 barre (%.2f)", gBarre.score, fBarre.score)
	}
}

func TestLowIntervalViolations(t *testing.T) {
	cases := []struct {
		midis []int
		want  int
	}{
		{[]int{40, 44}, 1},     // M3 on E2 — far below the Bb2 floor
		{[]int{52, 55}, 0},     // m3 on E3 — above the C3 floor
		{[]int{40, 47}, 0},     // P5 on E2 — fifths are fine almost anywhere
		{[]int{40, 52}, 0},     // octave — unlimited
		{[]int{45, 50, 62}, 1}, // P4 on A2 is one semitone under its Bb2 floor
	}
	for _, c := range cases {
		if got := lowIntervalViolations(c.midis); got != c.want {
			t.Errorf("lowIntervalViolations(%v) = %d, want %d", c.midis, got, c.want)
		}
	}
}
