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
		{OpenMidi: []int{40}, Tones: []int{0}, Root: 1, Bass: -1, MaxFret: 24},
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
