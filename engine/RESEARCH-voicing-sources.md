# Voicing ergonomics & construction — sources

The rules in `voicing.go` and `PROMPT-ergonomic-guitar-chords.md` are grounded in
the sources below, gathered 2026-07-30. Every claim comes from a page that was
actually fetched and read; secondary/unverified items are flagged. Three tracks:
academic fingering-difficulty models, hand ergonomics & pedagogy, and voicing
construction practice.

---

## Part 1 · Academic fingering-difficulty models

**Heijink & Meulenbroek (2002), "On the Complexity of Classical Guitar
Playing"** — *J. Motor Behavior* 34(4). Full text:
<https://www.socsci.ru.nl/meulenbroek/Publications/Heijink%20en%20Meulenbroek%202002.pdf>
The only controlled motion-capture experiment in the set (6 professional
classical guitarists). Difficulty ranking from expert ratings: **hand
repositioning strongest** (χ²=34.85), **finger span second** (χ²=19.41,
5-fret span rated harder than 4), **neck position weakest** (fret 8 rated
*harder* than frets 1/4). Free-choice fingerings almost never exceeded a
4-fret span. Key geometry: **interfret spacing runs 12.9–36.5 mm**, so the
same fret-span is a much larger physical stretch near the nut; string action
rises toward the body, shrinking placement tolerance at high frets.

**Radicioni & Lombardo (2005), "Guitar Fingering for Music Performance"**
(ICMC). Full text: <http://www.di.unito.it/~radicion/papers/radicioni05guitar.pdf>
The most explicit published numeric cost model. Chord difficulty = sum of
pairwise finger-transition weights. Fret-stretch cost 0.5–5 with per-finger-pair
comfortable spans (index–middle 0–1 frets, index–ring 2); **locality cost
0.25 × (fret_p + fret_q)** — higher positions intrinsically harder (action
~0.05 cm at fret 5 vs ~0.2 cm at fret 12); moving toward the nut costs more
than toward the body; across-string cost deliberately tiny vs along-neck.
Validated 90.6% against a conservatory guitarist; residual errors were
idiomatic patterns the biomechanics misses.

**Tuohy & Potter (2005), GA tablature generation** (ICMC). Full text via
Wayback: <https://quod.lib.umich.edu/i/icmc/bbp2372.2005.013/--genetic-algorithm-for-the-automatic-generation-of-playable?rgn=main;view=fulltext>
Fitness penalizes fretted-note count, fret distance between adjacent notes,
and distance from the local average fret; rewards open strings. Barre validity
heuristics: barring finger across a fret, remaining fingers on higher frets
only. Caveat: open strings are *not* unconditionally easier mid-phrase.

**Radisavljevic & Driessen (2004), "Path Difference Learning"** (ICMC). Full
text: <https://www.mistic.ece.uvic.ca/publications/2004_icmc_pdl.pdf>
Separate static (chord-shape) and transition costs, both linear in features
(inter-finger fret span, average fret, open-string count); **weights learned
from published tablature** (errors 91→33), because hand-set weights are
subjective and style-dependent.

**Hori & Sagayama (2016), "Minimax Viterbi for HMM-Based Guitar Fingering"**
(ISMIR). Full text: <https://archives.ismir.net/ismir2016/paper/000285.pdf>
Finger-weakness priors: **index 0.35, middle 0.30, ring 0.25, pinky 0.10** —
the pinky is ~3.5× harder than the index. Playability is governed by the
single hardest move (minimax), not the sum. More time between chords = easier
transition.

**Sakai, Segawa & Kitahara (2024), lead-sheet → fingerstyle tablature** (SMC).
Full text: <https://smcnetwork.org/smc2024/papers/SMC2024_paper_id55.pdf>
Hard constraint: **chord fretted notes within 3 frets**. Database of 3,658
"typical forms"; familiar grips priced cheaper than modified ones (10 vs 12).
Initial cost doubles above fret 4; transition penalty +5 above fret 5.

**Kaliakatsos-Papakostas et al. (2022), MIDI→tab ML** (SMC). Full text:
<https://dorienherremans.com/sites/default/files/25.pdf>
Hard playability filter: non-open pitches within a **6-fret window** (outer
bound; "finger stretching of over 6 frets is not acceptable"); idiomatic shape
preference learned from 26k GuitarPro tabs.

**Grimes (2014), "String Theory — The Physics of String-Bending"** (PLOS ONE).
<https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0102088>
(equations render as images; direction-of-effect quotes verified) Fretting
force scales with string tension and **action height (dominant term)**,
inversely with vibrating length — pure single-note physics says *higher*
frets need more force. See "reconciliation" below.

**Sayegh (1989), optimum-path fingering** — paywalled, **not fetched**;
described secondhand in the papers above. No specific weights cited from it.

## Part 2 · Hand ergonomics & pedagogy

**StringKick, "How to Play Bar Chords"** —
<https://www.stringkick.com/blog-lessons/barre-chords/>
"Barre chords that are closer to the nut are more difficult to play"; F at
fret 1 "one of the most difficult barre chords there is" (max press force).
Learn barres at fret 7 first, work down. 5-string barres easier than 6-string.

**Classical Guitar Corner, "The Barre"** —
<https://www.classicalguitarcorner.com/the-barre/>
Two-string barres allow a bent finger; 3+ strings force a straight finger.
Start barres around fret 5–7. Power from arm weight, not thumb squeeze
(squeeze = fatigue). Don't barre more strings than needed.

**Douglas Niedt (concert classical guitarist)** —
<https://douglasniedt.com/Tech_Tip_Little_Jennifer.html>,
<https://douglasniedt.com/bar-notation.html>,
<https://douglasniedt.com/campanellapart1.html>
"String tension for the barre is less at the third fret than at the first
fret." Partial barres are defined on **inner/treble strings**, "NOT including
the string behind." Campanella (fretted + open ringing together) is a
500-year-old classical idiom, not an anti-pattern.

**frets.com (Frank Ford, luthier), "Nut Action"** —
<http://www.frets.com/FretsPages/Musician/GenSetup/NutAction/nutaction.html>
A slightly high nut — "extremely common" on new instruments — can make a
first-position F barre effectively impossible. Fret-1 effort is dominated by
nut setup.

**JustinGuitar community (player consensus, labeled as forum evidence)** —
<https://community.justinguitar.com/t/practicing-barre-chords-without-hurting-yourself/198475>
At fret 1 "strings are hardest to press and the frets are furthest apart."
Learn barres between frets 4–8 and move down. Reported injury (tennis elbow)
from forcing barre practice.

**Guitar Wiz, small hands** —
<https://guitarwiz.app/articles/guitar-exercises-small-hands/>
"The first fret to the fourth fret span is much larger than the 5th to 8th";
a 1–4 index-to-pinky hold is a *stretching drill*, not a baseline grip; three
fingertips in one fret (open A, 002220) flagged uncomfortable.

**FaChords, pinky independence** — <https://www.fachords.com/pinky-independence/>
Ring+pinky are the least independent pair; pinky-heavy grips fatigue fastest.

**Muting technique** — Guitar Scholar
<https://www.guitarscholar.co.uk/lessons/fret-hand-muting.php>, Classical
Guitar Shed <https://classicalguitarshed.com/muting/>, Acoustic Guitar
<https://store.acousticguitar.com/blogs/news/36695553-add-a-percussive-groove-to-your-playing-with-fretting-hand-muting>
Standard cheap mutes: thumb-over for low E; index drape for everything above
a fretted note; **fingertip overhang / finger-underside for a string adjacent
to a fretting finger** (the canonical octave-shape texture). A dead string
with *no* adjacent fretting finger needs a dedicated floating touch — no
pedagogical support as a normal texture.

**Injury prevention** — <https://guitaristshealth.com/guitar-injuries-symptoms-treatment/>,
<https://medchrome.com/extras/music/guitar-related-hand-injuries-prevention-and-treatment/>
"Over-stretching for wide chord shapes can cause lasting pain"; extreme
fretting-wrist flexion is the primary carpal/cubital tunnel risk factor.

**Yamaha Hub, high positions** —
<https://hub.yamaha.com/guitars/g-electric/how-to-play-the-high-notes-on-your-guitar/>
Frets narrow and action rises up the neck; the heel/body join blocks the hand;
prefer fingertips over barres in cramped upper positions.

### Reconciliation: why fret-1 barres hurt when pure physics says high frets need more force

Grimes' single-note model says fretting force rises with shorter vibrating
length (higher frets) and, dominantly, with action. Pedagogy is nonetheless
unanimous that *barres* are worst at fret 1. These are consistent: near the
nut the string terminates at a rigid point, so pressing **multiple strings**
there works against maximum string tension with the least compliance; fret
spacing is widest (biggest simultaneous span); and common nut-height defects
raise effective action exactly there. Action dominates in both accounts. The
engine therefore uses a U-shaped barre cost (worst at fret 1, minimum ~3–9,
rising past the body join) while keeping a mild general preference for low
positions on non-barre shapes.

## Part 3 · Voicing construction practice

**Low interval limits** — FunJazz chart (fetched PDF, pitches decoded and
verified): <https://funnelljazz.eu/wp-content/uploads/2020/12/Low-Interval-Limits.pdf>;
corroborated by <https://filmmusictheory.com/article/what-is-a-low-interval-limit/>
and <https://www.robin-hoffmann.com/dfsb/low-interval-limits/>.
Lowest usable bottom note per interval (concert pitch, C4 = middle C = MIDI 60):
m2 E3 · M2 E♭3 · m3 C3 · M3 B♭2 · P4 B♭2 · tritone B♭2 · P5 B♭1 · m6 G2 ·
M6 F2 · m7 F2 · M7 F2 · m9 E2 · M9 E♭2 · m10 C2 · M10 B♭1; unison/octave
unlimited. Explicitly loose guidelines — timbre/volume dependent, and
deliberate violation is a legitimate effect (relevant for doom).

**Shell voicings** — <https://www.jazz-guitar-licks.com/blog/lessons/shell-chords.html>,
<https://jazzguitartoday.com/2020/05/shell-voicings-and-guide-tones-with-extensions-a-new-jgt-lesson/>
Root + 3rd + 7th, 5th omitted first; roots on strings 6/5/4.

**Freddie Green practice** — <https://www.freddiegreen.org/technique/berens.html>,
<https://acousticguitar.com/learn-to-comp-like-jazz-legend-freddie-green/>
String sets 6-4-3 / 6-4-3-2; avoid P5 between strings 6–5 (mud); voice-lead by
holding common tones at the same fret/string.

**Drop-2 / drop-3** — <https://greenhillsguitarstudio.com/drop-2-and-drop-3-chords-for-guitar/>,
<https://www.guitarlessonworld.com/lessons/drop-2-chords/>,
<https://www.guitar-chord.org/articles/jazz-drop-3-voicings.html>
Drop-2 on adjacent string sets 1-4/2-5/3-6, **no doubled tones**; drop-3 skips
a string (6-x-4-3-2), the skipped string muted by the finger on string 6.

**Doubling & omission** — <https://mymusictheory.com/satb-harmony/satb-doubling-omissions-spacing/>,
<https://musictheory.pugetsound.edu/mt21c/JazzChordVoicings.html>
Double root freely, 5th acceptably; avoid doubling major 3rds/leading tones;
omit the 5th first; guide tones (3rd/7th) define the chord. Spacing widens
toward the bass.

**Open strings & drones** — <https://blog.truefire.com/guitar-lessons/open-string-voicings-richer-guitar-sound/>,
<https://www.fundamental-changes.com/dadgad-open-chords/>,
<https://douglasniedt.com/campanellapart1.html>
Open strings ring full-length (more sustain/overtones); chord-tone opens are a
feature, including against high-position fretted notes (campanella, DADGAD).
Test: chord tone → let ring; half-step from a chord tone → mute.

**Voice leading** — <https://online.berklee.edu/takenote/voice-leading-for-guitar/>
Hold common tones (same fret/string), move other voices by step or ≤ a major
3rd. (Not yet implemented — per-chord generation doesn't see neighbors; noted
under Gaps.)

---

## Rule → engine mapping

| Rule | Source(s) | Code (voicing.go) |
|---|---|---|
| Span ≤3 frets hard cap; span is a stretch | Sakai (3-fret constraint), Heijink, Kaliakatsos (6-fret outer bound) | search window `SpanFrets=4`; `span × 1.2` |
| Same span is wider near the nut | Heijink interfret geometry, Guitar Wiz | `span × (5 − minFret) × 0.15` below fret 5 |
| Mild low-position preference (non-barre) | Radicioni locality, Sakai, pedagogy | `minFret × 0.3` |
| Barre cost U-curve: fret 1 worst, ~3–9 sweet spot, high again past body join | StringKick, CGC, Niedt, JustinGuitar, frets.com, Yamaha | barre position surcharge: +3.5 @1, +2.0 @2, +1.0 @3, +0.5 @10–11, +1.5 @≥12 |
| Bigger barres cost more; 2-string barres cheap | StringKick, CGC | `0.6 + 0.3 × barredStrings` |
| Pinky engagement is disproportionately hard | Hori (0.35/0.30/0.25/0.10), FaChords | +0.6 when 4 fingers used |
| 3+ separate fingertips on one fret is cramped | Guitar Wiz (002220), Niedt (partial barre substitutes) | +1.5 cluster penalty |
| Inner mute cheap only beside a fretting finger | Guitar Scholar, CGS, drop-3 practice | +2.0 adjacent-fretted, +5.0 floating |
| Low interval limits (mud floor per interval) | FunJazz chart, filmmusictheory, Hoffmann | `lowIntervalViolations` × 1.25 |
| Don't double tensions; root/5th double freely | MyMusicTheory, drop-2 practice | +0.4 per extra non-root/non-5th doubling |
| Opens are good low, legitimate (not penalized as wrong) high | Tuohy, TrueFire, campanella, DADGAD | −0.7/open below fret 5, 0.0 at 5–6, +0.2 at ≥7 |
| Root in bass unless slash bass | classical/jazz baseline | ±3.0 |

## Known gaps (deliberate)

- **Voice leading between chords**: the engine scores shapes in isolation.
  Berklee/Freddie Green common-tone rules would need progression-aware
  generation (documented for a future pass).
- **Familiar-shape priors**: Sakai and the ML papers show idiomatic grips beat
  biomechanically-equal unfamiliar ones; we have no typical-forms database.
- **Weights are hand-tuned**: Radisavljevic and Kaliakatsos both show weights
  should be *learned* from real tablature. Ours are calibrated against known
  canonical shapes (tests) — a corpus fit would be better.
- **Fret-1 barre hardness** is pedagogically unanimous but has no controlled
  academic measurement; the physics reconciliation above is our own analysis.
