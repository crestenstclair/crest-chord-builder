package engine

import "fmt"

type Finger int

// Position identifies one physical string and fret, using bass-to-treble indices.
type Position struct {
	String int `json:"string"`
	Fret   int `json:"fret"`
}

// Request describes a chord in concert pitch. OpenMidi follows physical string
// order (bass side to treble side), which need not be ascending in pitch.
type Request struct {
	OpenMidi []int     `json:"openMidi"`
	Tones    []int     `json:"tones"`
	Root     int       `json:"root"`
	Bass     int       `json:"bass"`    // -1 allows any inversion
	MinFret  int       `json:"minFret"` // open strings remain available
	MaxFret  int       `json:"maxFret"`
	Anchor   *Position `json:"anchor,omitempty"`
}

type Voicing struct {
	Frets   []int    `json:"frets"`
	Fingers []Finger `json:"fingers"`
	Score   float64  `json:"score"`
}

// Generate validates the browser boundary before searching a bounded neck.
// Extended chords may omit a perfect fifth; all other tones are required.
// An anchor returns every playable nearby shape containing that exact position.
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
	candidates := generateVoicings(r.OpenMidi, spec, genConfig{MinFret: r.MinFret, MaxFret: r.MaxFret, SpanFrets: 4, Results: 12, Anchor: r.Anchor})
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
	if r.MinFret < 0 || r.MinFret > r.MaxFret-3 {
		return fmt.Errorf("hand position must allow at least four frets")
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
	if r.Bass >= 0 && !seen[r.Bass] {
		return fmt.Errorf("bass must be a chord tone")
	}
	if r.Anchor != nil {
		if r.Anchor.String < 0 || r.Anchor.String >= len(r.OpenMidi) || r.Anchor.Fret < 0 || r.Anchor.Fret > 24 {
			return fmt.Errorf("anchor must identify an existing string and fret 0–24")
		}
		if !seen[(r.OpenMidi[r.Anchor.String]+r.Anchor.Fret)%12] {
			return fmt.Errorf("anchor must be a chord tone")
		}
	}
	return nil
}
