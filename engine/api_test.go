package engine

import "testing"

func TestGenerateBoundary(t *testing.T) {
	valid := Request{OpenMidi: []int{40, 45, 50, 55, 59, 64}, Tones: []int{9, 0, 4, 7}, Root: 9, Bass: -1, MaxFret: 24}
	shapes, err := Generate(valid)
	if err != nil || len(shapes) == 0 {
		t.Fatalf("expected Am7 grips: %v", err)
	}
	for _, shape := range shapes {
		if len(shape.Frets) != 6 {
			t.Fatal("wrong string count")
		}
		for _, fret := range shape.Frets {
			if fret < -1 || fret > 24 {
				t.Fatal("fret outside bounds")
			}
		}
	}
	invalid := []Request{
		{OpenMidi: []int{104}, Tones: []int{0}, Root: 0, Bass: -1, MaxFret: 24},
		{OpenMidi: []int{40}, Tones: []int{0, 0}, Root: 0, Bass: -1, MaxFret: 24},
		{OpenMidi: []int{40}, Tones: []int{0}, Root: 12, Bass: -1, MaxFret: 24},
		{OpenMidi: []int{40}, Tones: []int{0}, Root: 0, Bass: 2, MaxFret: 24},
		{OpenMidi: []int{40}, Tones: []int{0}, Root: 0, Bass: -1, MaxFret: 100},
	}
	for _, request := range invalid {
		if _, err := Generate(request); err == nil {
			t.Errorf("accepted invalid input: %+v", request)
		}
	}
}

func TestReentrantBassIsLowestSoundingPitch(t *testing.T) {
	// The physical first string is E4; the actual bass is A2 on string 2.
	open := []int{64, 45, 50, 55, 59, 40}
	spec := chordSpec{required: []int{9, 0, 4, 7}, all: []int{9, 0, 4, 7}, rootPC: 9, bassPC: 9}
	if _, ok := evaluateShape([]int{0, 0, 2, 0, 1, -1}, open, spec); !ok {
		t.Fatal("re-entrant Am7 should have A bass")
	}
	spec.bassPC = 4
	if _, ok := evaluateShape([]int{0, 0, 2, 0, 1, -1}, open, spec); ok {
		t.Fatal("physical first string must not be mistaken for bass")
	}
}

func TestRootlessAndHandPosition(t *testing.T) {
	shapes, err := Generate(Request{OpenMidi: []int{40, 45, 50, 55, 59, 64}, Tones: []int{0, 4, 7}, Root: 9, Bass: 0, MinFret: 5, MaxFret: 8})
	if err != nil || len(shapes) == 0 {
		t.Fatalf("expected rootless Am7/C in position 5–8: %v", err)
	}
	for _, shape := range shapes {
		for _, fret := range shape.Frets {
			if fret > 0 && (fret < 5 || fret > 8) {
				t.Fatalf("fret outside hand position: %v", shape.Frets)
			}
		}
	}
	_, err = Generate(Request{OpenMidi: []int{40, 45, 50, 55, 59, 64}, Tones: []int{0, 4, 7}, Root: 0, Bass: -1, MinFret: 7, MaxFret: 8})
	if err == nil {
		t.Fatal("accepted invalid hand-position range")
	}
}

func TestAnchoredVoicings(t *testing.T) {
	for _, tuning := range [][]int{
		{40, 45, 50, 55, 59, 64},
		{35, 40, 45, 50, 55, 59, 64},
		{28, 35, 40, 45, 50, 55, 59, 64},
	} {
		anchor := &Position{String: len(tuning) - 2, Fret: 1}
		r := Request{OpenMidi: tuning, Tones: []int{9, 0, 4, 7}, Root: 9, Bass: -1, MaxFret: 24, Anchor: anchor}
		shapes, err := Generate(r)
		if err != nil || len(shapes) <= 12 {
			t.Fatalf("expected all nearby %d-string shapes, not a top-12 filter: %d, %v", len(tuning), len(shapes), err)
		}
		seen := map[string]bool{}
		for i, shape := range shapes {
			if shape.Frets[anchor.String] != anchor.Fret {
				t.Fatalf("missing exact anchor: %v", shape.Frets)
			}
			for _, fret := range shape.Frets {
				if fret > 4 {
					t.Fatalf("not near fret 1: %v", shape.Frets)
				}
			}
			key := shapeKey(shape.Frets)
			if seen[key] || (i > 0 && shape.Score < shapes[i-1].Score) {
				t.Fatal("results must be unique and ranked")
			}
			seen[key] = true
		}
		// Verify completeness against exhaustive enumeration of the local window.
		spec := chordSpec{required: r.Tones, all: r.Tones, rootPC: r.Root, bassPC: r.Bass}
		options := candidateFrets(tuning, spec, 1, genConfig{MaxFret: 4, SpanFrets: 4})
		enumerate(options, func(frets []int) {
			if frets[anchor.String] != anchor.Fret {
				return
			}
			if _, ok := evaluateShape(frets, tuning, spec); ok && !seen[shapeKey(frets)] {
				t.Fatalf("omitted playable anchored shape: %v", frets)
			}
		})
	}
}

func TestAnchorBoundsAndBassFilter(t *testing.T) {
	r := Request{OpenMidi: []int{40, 45, 50, 55, 59, 64}, Tones: []int{9, 0, 4, 7}, Root: 9, Bass: 0, MaxFret: 24, Anchor: &Position{String: 2, Fret: 7}}
	shapes, err := Generate(r)
	if err != nil || len(shapes) == 0 {
		t.Fatalf("expected anchored Am7/C: %v", err)
	}
	for _, shape := range shapes {
		lowest := 128
		for s, fret := range shape.Frets {
			if fret > 0 && (fret < 4 || fret > 10) {
				t.Fatalf("shape is too far from anchor: %v", shape.Frets)
			}
			if fret >= 0 {
				lowest = min(lowest, r.OpenMidi[s]+fret)
			}
		}
		if shape.Frets[2] != 7 || lowest%12 != 0 {
			t.Fatalf("anchor or inversion ignored: %v", shape.Frets)
		}
	}
	r.MinFret, r.MaxFret = 13, 16
	shapes, err = Generate(r)
	if err != nil || len(shapes) != 0 {
		t.Fatal("conflicting hand position must return no shapes")
	}
	r.MinFret, r.MaxFret = 0, 24
	r.Anchor = &Position{String: 3, Fret: 0}
	r.Bass = -1
	shapes, err = Generate(r)
	if err != nil || len(shapes) == 0 {
		t.Fatal("open-string anchors must work")
	}
	for _, shape := range shapes {
		if shape.Frets[3] != 0 {
			t.Fatal("open anchor was lost")
		}
		for _, fret := range shape.Frets {
			if fret > 4 {
				t.Fatal("open anchor searched beyond nut position")
			}
		}
	}
	for _, anchor := range []*Position{{String: -1}, {String: 6}, {Fret: -1}, {Fret: 25}, {String: 5, Fret: 1}} {
		r.Anchor = anchor
		if _, err = Generate(r); err == nil {
			t.Fatalf("accepted invalid anchor: %+v", anchor)
		}
	}
}

func TestMultipleAnchorsNarrowCompleteResults(t *testing.T) {
	for _, tuning := range [][]int{
		{40, 45, 50, 55, 59, 64},
		{35, 40, 45, 50, 55, 59, 64},
		{28, 35, 40, 45, 50, 55, 59, 64},
	} {
		c := Position{String: len(tuning) - 2, Fret: 1}
		g := Position{String: len(tuning) - 3, Fret: 0}
		r := Request{OpenMidi: tuning, Tones: []int{9, 0, 4, 7}, Root: 9, Bass: -1, MaxFret: 24, Anchors: []Position{c}}
		all, err := Generate(r)
		if err != nil {
			t.Fatal(err)
		}
		expected := map[string]bool{}
		for _, shape := range all {
			if shape.Frets[g.String] == g.Fret {
				expected[shapeKey(shape.Frets)] = true
			}
		}
		r.Anchors = []Position{g, c} // An open constraint must not depend on click order.
		narrowed, err := Generate(r)
		if err != nil || len(narrowed) == 0 || len(narrowed) >= len(all) || len(narrowed) != len(expected) {
			t.Fatalf("expected complete narrowed results for %d strings: %d -> %d, %v", len(tuning), len(all), len(narrowed), err)
		}
		for _, shape := range narrowed {
			if !expected[shapeKey(shape.Frets)] {
				t.Fatalf("result violates required notes: %v", shape.Frets)
			}
		}
		r.Anchors = []Position{c, {String: len(tuning) - 1, Fret: 5}}
		incompatible, err := Generate(r)
		if err != nil || len(incompatible) != 0 {
			t.Fatal("required notes outside one hand span must return no results")
		}
	}
}

func TestMultipleAnchorValidation(t *testing.T) {
	r := Request{OpenMidi: []int{40, 45, 50, 55, 59, 64}, Tones: []int{9, 0, 4, 7}, Root: 9, Bass: -1, MaxFret: 24}
	for _, anchors := range [][]Position{
		{{String: 4, Fret: 1}, {String: 4, Fret: 5}},
		{{String: 4, Fret: 1}, {String: 4, Fret: 1}},
		{{String: 6}}, {{String: -1}}, {{Fret: 25}}, {{String: 5, Fret: 1}},
	} {
		r.Anchors = anchors
		if _, err := Generate(r); err == nil {
			t.Fatalf("accepted invalid anchors: %+v", anchors)
		}
	}
	r.Anchor = &Position{String: 4, Fret: 1}
	r.Anchors = []Position{{String: 3, Fret: 0}}
	if _, err := Generate(r); err == nil {
		t.Fatal("accepted ambiguous single and multiple anchor fields")
	}
}
