package engine

import "fmt"

type Finger int

// Request describes a chord in concert pitch. OpenMidi follows physical string
// order (bass side to treble side), which need not be ascending in pitch.
type Request struct {
	OpenMidi []int `json:"openMidi"`
	Tones    []int `json:"tones"`
	Root     int   `json:"root"`
	Bass     int   `json:"bass"` // -1 allows any inversion
	MaxFret  int   `json:"maxFret"`
}

type Voicing struct {
	Frets   []int    `json:"frets"`
	Fingers []Finger `json:"fingers"`
	Score   float64  `json:"score"`
}

// Generate validates the browser boundary before searching a bounded neck.
// Extended chords may omit a perfect fifth; all other tones are required.
func Generate(r Request) ([]Voicing, error) {
	if err := r.validate(); err != nil {
		return nil, err
	}
	required := []int{}
	for _, pc := range r.Tones {
		if len(r.Tones) < 5 || pc != (r.Root+7)%12 {
			required = append(required, pc)
		}
	}
	spec := chordSpec{required: required, all: r.Tones, rootPC: r.Root, bassPC: r.Bass}
	candidates := generateVoicings(r.OpenMidi, spec, genConfig{MaxFret: r.MaxFret, SpanFrets: 4, Results: 12})
	result := make([]Voicing, 0, len(candidates))
	for _, c := range candidates {
		result = append(result, Voicing{c.frets, c.fingers, c.score})
	}
	return result, nil
}

func (r Request) validate() error {
	if len(r.OpenMidi) < 1 || len(r.OpenMidi) > 8 {
		return fmt.Errorf("use 1–8 strings")
	}
	if r.MaxFret < 4 || r.MaxFret > 24 {
		return fmt.Errorf("maximum fret must be 4–24")
	}
	for _, n := range r.OpenMidi {
		if n < 0 || n > 103 {
			return fmt.Errorf("open pitch must be MIDI 0–103")
		}
	}
	if r.Root < 0 || r.Root > 11 || r.Bass < -1 || r.Bass > 11 {
		return fmt.Errorf("invalid root or bass")
	}
	if len(r.Tones) < 1 || len(r.Tones) > 7 {
		return fmt.Errorf("use 1–7 chord tones")
	}
	seen := map[int]bool{}
	for _, pc := range r.Tones {
		if pc < 0 || pc > 11 || seen[pc] {
			return fmt.Errorf("invalid or repeated chord tone")
		}
		seen[pc] = true
	}
	if !seen[r.Root] {
		return fmt.Errorf("root must be a chord tone")
	}
	if r.Bass >= 0 && !seen[r.Bass] {
		return fmt.Errorf("bass must be a chord tone")
	}
	return nil
}
