package engine

import (
	"sort"
	"strconv"
)

// chordSpec is the pitch-class description of a chord the voicing search targets.
type chordSpec struct {
	required []int // pitch classes every voicing must contain
	all      []int // required + optional pitch classes
	rootPC   int
	bassPC   int // -1 when any bass is acceptable (root is still preferred)
}

type genConfig struct {
	MinFret   int        // first permitted fretted position; open strings are allowed
	MaxFret   int        // highest fret the search will use
	SpanFrets int        // width of the fretting-hand window, in frets
	Results   int        // how many voicings to return
	Anchors   []Position // no anchors searches the whole allowed neck
}

type candidate struct {
	frets   []int // -1 muted, 0 open, >0 fretted
	fingers []Finger
	score   float64
	barre   bool
}

// generateVoicings searches the fretboard for playable shapes that spell the
// chord, scores them for ergonomics, and returns the best ones — most
// comfortable first, filtered so the results are meaningfully different shapes.
func generateVoicings(openMidi []int, spec chordSpec, cfg genConfig) []candidate {
	best := map[string]candidate{}

	lastPos := cfg.MaxFret - cfg.SpanFrets + 1
	if lastPos < 1 {
		lastPos = 1
	}
	for pos := max(1, cfg.MinFret); pos <= lastPos; pos++ {
		if !anchorsInWindow(cfg.Anchors, pos, cfg.SpanFrets) {
			continue
		}
		options := candidateFrets(openMidi, spec, pos, cfg)
		enumerate(options, func(frets []int) {
			cand, ok := evaluateShape(frets, openMidi, spec)
			if !ok {
				return
			}
			key := shapeKey(frets)
			if existing, seen := best[key]; !seen || cand.score < existing.score {
				best[key] = cand
			}
		})
	}

	sorted := make([]candidate, 0, len(best))
	for _, cand := range best {
		sorted = append(sorted, cand)
	}
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].score != sorted[j].score {
			return sorted[i].score < sorted[j].score
		}
		return shapeKey(sorted[i].frets) < shapeKey(sorted[j].frets)
	})

	if len(cfg.Anchors) > 0 {
		return sorted
	}
	return diversify(sorted, cfg.Results)
}

// Every fretted anchor must fit the same hand window. Open strings are allowed
// anywhere; when all anchors are open, search at the nut.
func anchorsInWindow(anchors []Position, pos, span int) bool {
	fretted := false
	for _, anchor := range anchors {
		if anchor.Fret == 0 {
			continue
		}
		fretted = true
		if anchor.Fret < pos || anchor.Fret >= pos+span {
			return false
		}
	}
	return len(anchors) == 0 || fretted || pos == 1
}

// candidateFrets lists, per string, every fret worth trying with the hand at
// pos: muted, the open string when it belongs to the chord, and any in-window
// fret that lands on a chord tone.
func candidateFrets(openMidi []int, spec chordSpec, pos int, cfg genConfig) [][]int {
	inChord := map[int]bool{}
	for _, pc := range spec.all {
		inChord[pc] = true
	}
	options := make([][]int, len(openMidi))
	for s, open := range openMidi {
		opts := []int{-1}
		if inChord[open%12] {
			opts = append(opts, 0)
		}
		for f := pos; f < pos+cfg.SpanFrets && f <= cfg.MaxFret; f++ {
			if inChord[(open+f)%12] {
				opts = append(opts, f)
			}
		}
		options[s] = opts
	}
	for _, anchor := range cfg.Anchors {
		options[anchor.String] = []int{anchor.Fret}
	}
	return options
}

func enumerate(options [][]int, visit func([]int)) {
	frets := make([]int, len(options))
	var walk func(int)
	walk = func(s int) {
		if s == len(options) {
			visit(frets)
			return
		}
		for _, f := range options[s] {
			frets[s] = f
			walk(s + 1)
		}
	}
	walk(0)
}

// lowIntervalFloor maps an interval (in semitones) to the lowest MIDI note its
// bottom voice can sit on before the pair turns muddy. Values are the standard
// arranging "low interval limits" chart (concert pitch, C4 = 60); unisons,
// octaves, and intervals wider than a major 10th are unrestricted. See
// RESEARCH-voicing-sources.md.
var lowIntervalFloor = map[int]int{
	1: 52, 2: 51, 3: 48, 4: 46, 5: 46, 6: 46,
	7: 34, 8: 43, 9: 41, 10: 41, 11: 41,
	13: 40, 14: 39, 15: 36, 16: 34,
}

// lowIntervalViolations counts adjacent sounding-string pairs that sit below
// the low interval limit for their interval.
func lowIntervalViolations(midis []int) int {
	violations := 0
	for i := 0; i+1 < len(midis); i++ {
		lo, hi := midis[i], midis[i+1]
		if lo > hi {
			lo, hi = hi, lo
		}
		if floor, limited := lowIntervalFloor[hi-lo]; limited && lo < floor {
			violations++
		}
	}
	return violations
}

// evaluateShape rejects unplayable or incomplete shapes and scores the rest.
// Lower scores are more ergonomic. The cost terms and their sources are
// documented in RESEARCH-voicing-sources.md ("Rule → engine mapping").
func evaluateShape(frets []int, openMidi []int, spec chordSpec) (candidate, bool) {
	var sounding, fretted []int
	for s, f := range frets {
		if f >= 0 {
			sounding = append(sounding, s)
		}
		if f >= 1 {
			fretted = append(fretted, s)
		}
	}
	if len(sounding) < 3 || len(sounding) < len(spec.required) {
		return candidate{}, false
	}

	present := map[int]bool{}
	midis := make([]int, 0, len(sounding))
	for _, s := range sounding {
		midi := openMidi[s] + frets[s]
		midis = append(midis, midi)
		present[midi%12] = true
	}
	for _, pc := range spec.required {
		if !present[pc] {
			return candidate{}, false
		}
	}

	// Tunings may be re-entrant: the lowest sounding pitch owns the bass.
	bassMidi := midis[0]
	for _, midi := range midis[1:] {
		if midi < bassMidi {
			bassMidi = midi
		}
	}
	bass := bassMidi % 12
	if spec.bassPC >= 0 && bass != spec.bassPC {
		return candidate{}, false
	}

	// A dead string between sounding strings is normal when the underside of
	// a neighbouring fretting finger can damp it (the octave/drop-3 texture);
	// with only open strings around it, it needs a dedicated floating touch.
	innerMutes := 0
	innerMuteCost := 0.0
	for s := sounding[0] + 1; s < sounding[len(sounding)-1]; s++ {
		if frets[s] >= 0 {
			continue
		}
		innerMutes++
		if (s > 0 && frets[s-1] >= 1) || (s < len(frets)-1 && frets[s+1] >= 1) {
			innerMuteCost += 2.0
		} else {
			innerMuteCost += 5.0
		}
	}
	if innerMutes > 1 {
		return candidate{}, false
	}

	fingers, fingerCount, barreSize, playable := fingering(frets)
	if !playable {
		return candidate{}, false
	}

	span, minFret := 0, 0
	if len(fretted) > 0 {
		minFret = frets[fretted[0]]
		maxFret := minFret
		for _, s := range fretted {
			if frets[s] < minFret {
				minFret = frets[s]
			}
			if frets[s] > maxFret {
				maxFret = frets[s]
			}
		}
		span = maxFret - minFret
	}

	opens, mutes := 0, 0
	for _, f := range frets {
		if f == 0 {
			opens++
		}
		if f < 0 {
			mutes++
		}
	}
	missingOptional := 0
	for _, pc := range spec.all {
		if !present[pc] {
			missingOptional++
		}
	}

	score := float64(fingerCount)
	if fingerCount >= 4 {
		// Four-finger grips engage the pinky, by far the weakest finger.
		score += 0.6
	}

	// Spans cost more near the nut, where the same fret count is a physically
	// wider stretch.
	score += float64(span) * 1.2
	if minFret >= 1 && minFret < 5 {
		score += float64(span) * float64(5-minFret) * 0.15
	}
	score += float64(minFret) * 0.3

	score += innerMuteCost
	score += float64(mutes) * 0.15
	score += float64(missingOptional) * 0.9

	// Open strings ring freely and save fingers near the nut; mixed with a
	// high hand position they are a legitimate drone/campanella texture, so
	// they cost only a token amount of control up there.
	openAdj := -0.7
	switch {
	case minFret >= 7:
		openAdj = 0.2
	case minFret >= 5:
		openAdj = 0.0
	}
	score += float64(opens) * openAdj

	if barreSize > 0 {
		// Barre cost grows with barred strings and follows a U-curve over
		// position: worst at fret 1 (max string tension at the nut, widest
		// frets), comfortable ~3-9, awkward again past the body join.
		score += 0.6 + 0.3*float64(barreSize)
		switch {
		case minFret == 1:
			score += 3.5
		case minFret == 2:
			score += 2.0
		case minFret == 3:
			score += 1.0
		case minFret >= 12:
			score += 1.5
		case minFret >= 10:
			score += 0.5
		}
	} else if len(fretted) >= 3 {
		// Three or more separate fingertips stacked on one fret is cramped.
		perFret := map[int]int{}
		for _, s := range fretted {
			perFret[frets[s]]++
		}
		for _, n := range perFret {
			if n >= 3 {
				score += 1.5
			}
		}
	}

	score += 1.25 * float64(lowIntervalViolations(midis))

	// Doubling the root or 5th is free; doubling color tones muddies them.
	fifth := (spec.rootPC + 7) % 12
	pcCounts := map[int]int{}
	for _, midi := range midis {
		pcCounts[midi%12]++
	}
	for pc, n := range pcCounts {
		if n > 1 && pc != spec.rootPC && pc != fifth {
			score += 0.4 * float64(n-1)
		}
	}

	if bass == spec.rootPC {
		score -= 3.0
	} else {
		score += 3.0
	}

	return candidate{
		frets:   append([]int(nil), frets...),
		fingers: fingers,
		score:   score,
		barre:   barreSize > 0,
	}, true
}

// fingering assigns left-hand fingers to a shape. Up to four fretted strings
// get one finger each, lowest fret first; busier shapes must be playable as a
// barre (index finger flattened across the highest strings) or are rejected.
// barreSize is the number of barred strings, 0 when no barre is needed.
func fingering(frets []int) (fingers []Finger, count int, barreSize int, ok bool) {
	fingers = make([]Finger, len(frets))
	var fretted []int
	for s, f := range frets {
		if f >= 1 {
			fretted = append(fretted, s)
		}
	}
	if len(fretted) == 0 {
		return fingers, 0, 0, true
	}

	assign := func(strings []int, first Finger) {
		sort.Slice(strings, func(i, j int) bool {
			if frets[strings[i]] != frets[strings[j]] {
				return frets[strings[i]] < frets[strings[j]]
			}
			return strings[i] < strings[j]
		})
		next := first
		for _, s := range strings {
			fingers[s] = next
			if next < 4 {
				next++
			}
		}
	}

	if len(fretted) <= 4 {
		assign(append([]int(nil), fretted...), 1)
		return fingers, len(fretted), 0, true
	}

	// Barre attempt: find the longest run of fretted strings ending at the
	// highest string; the index finger flattens across those at the lowest fret.
	barreStart := len(frets)
	for s := len(frets) - 1; s >= 0 && frets[s] >= 1; s-- {
		barreStart = s
	}
	minFret := frets[fretted[0]]
	for _, s := range fretted {
		if frets[s] < minFret {
			minFret = frets[s]
		}
	}
	var barred, others []int
	for _, s := range fretted {
		if s >= barreStart && frets[s] == minFret {
			barred = append(barred, s)
		} else {
			others = append(others, s)
		}
	}
	if len(barred) < 2 || 1+len(others) > 4 {
		return nil, 0, 0, false
	}
	for _, s := range barred {
		fingers[s] = 1
	}
	assign(others, 2)
	return fingers, 1 + len(others), len(barred), true
}

// diversify walks the score-ordered list and keeps shapes that differ from
// every accepted shape on at least two strings, so the player cycles through
// genuinely different grips instead of near-duplicates.
func diversify(sorted []candidate, limit int) []candidate {
	if limit <= 0 || len(sorted) == 0 {
		return nil
	}
	var picked, skipped []candidate
	for _, cand := range sorted {
		if len(picked) >= limit {
			break
		}
		distinct := true
		for _, chosen := range picked {
			if shapeDistance(cand.frets, chosen.frets) < 2 {
				distinct = false
				break
			}
		}
		if distinct {
			picked = append(picked, cand)
		} else {
			skipped = append(skipped, cand)
		}
	}
	for _, cand := range skipped {
		if len(picked) >= limit {
			break
		}
		picked = append(picked, cand)
	}
	return picked
}

func shapeDistance(a, b []int) int {
	diff := 0
	for i := range a {
		if a[i] != b[i] {
			diff++
		}
	}
	return diff
}

func shapeKey(frets []int) string {
	key := ""
	for _, f := range frets {
		key += strconv.Itoa(f) + "."
	}
	return key
}
