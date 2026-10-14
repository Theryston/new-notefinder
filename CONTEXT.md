# notefinder

notefinder shows the vocal notes a singer hits in a song, synced with
playback, with real-time pitch feedback from the user's mic.

## Language

### Accounts

**User**:
A person with an account on notefinder, signed up by email or Google.
_Avoid_: Account (for the person), member, customer

**Username**:
The unique, lowercase handle that addresses a User's public profile. Chosen
once (at sign-up, or on the setup step for Google users) and never changed
afterwards.
_Avoid_: Handle, login, slug

**Name**:
The free-text name a User shows to others; editable at any time.
_Avoid_: Display name, full name, nickname

**Avatar**:
The picture that represents a User, either uploaded by them or brought from
Google; without one, the User's initials stand in.
_Avoid_: Profile picture, photo, image (for the concept)

**Profile**:
The public page of a User, addressed by their Username, showing their Name
and Avatar.
_Avoid_: Account page, user page

### Music catalog

**Music catalog**:
Every Recording in the world with its artists, releases, genres and Lyrics,
kept in sync with MusicBrainz. It is where notefinder's own catalog (the
Tracks, Artists and Albums that have notes and public URLs) finds songs; a
Recording is not a Track until a User asks notefinder to process it.
_Avoid_: Catalog (alone, which means notefinder's own catalog)

**Track**:
A Recording taken into notefinder's own catalog, with its own public URL.
It exists from the moment a User asks for it to be processed, and has
vocal notes only once its Processing completes. One Track per Recording.
_Avoid_: Song, music

**Processing**:
One run of the pipeline that turns a Track's Recording into vocal notes and
Lyrics timed to the audio: it finds the Recording's video, gets its audio,
separates the vocals, detects the notes and transcribes the words. It ends
completed or failed; a failed Processing can be retried, which starts a new
Processing that picks up where the failed one stopped.
_Avoid_: Import (used for the legacy and MusicBrainz imports), job

**Vocal note**:
One note the singer of a Track hits: a single pitch held from a start to an
end time. The pitch is continuous (it may sit between two keys); the note's
name, like C#4, is the nearest key to it. Found by the Note detection of a
Processing.
_Avoid_: MIDI note, frame

**Pitch curve**:
The singer's pitch over the whole Track, moment by moment, including the
slides and vibrato between and within Vocal notes. Found by the Note detection
alongside the Vocal notes.
_Avoid_: Melody, f0, contour

**Note detection**:
The part of a Processing that separates a Track's vocals from its music and
finds the Vocal notes in them.
_Avoid_: Transcription (which makes the Timed lyrics), pitch tracking

**Contributor**:
A User who has done at least one Contribution to a Track. A User is a
Contributor of a Track once, however many Contributions they make to it.
_Avoid_: Author, owner, creator (for the person)

**Contribution**:
One action a Contributor did on a Track, of a given kind (the first kind is
asking for the Track to be created). Every new action is a new
Contribution, so a Track keeps the history of who did what and when.
_Avoid_: Edit (for the general concept), credit

**Recording**:
One specific audio take of a piece of music, as MusicBrainz defines it (a
studio take, a live take and a remaster are different Recordings). It is
what the music catalog searches and returns, one result per Recording, never
grouped, because a singer may want to practice a specific take (e.g. one
sung in a different key).
_Avoid_: Song, track (for this concept)

**Lyrics**:
The words sung in a Recording, plain or synced to time, matched to the
Recording from an open lyrics source.
_Avoid_: Letra, text

**Timed lyrics**:
The words of a Track, each timed to the audio the Track plays, grouped in
lines. Transcribed from the Track's vocals during Processing (the Lyrics, when
the Recording has them, only guide the transcription) and editable by
Contributors afterwards. Users see both as "lyrics".
_Avoid_: Lyrics (for this concept), transcript, subtitles

**Album**:
A notefinder catalog entity with its own public URL, backed by one MusicBrainz
release group: the album across all of its editions, so every edition of one
album shares one URL. It exists once its Recordings are reprocessed (see
`docs/adr/0003-album-is-a-release-group.md`).
_Avoid_: Release (an edition of an album), record, LP

### Practice

**Practice day**:
The calendar day of a User, in their own time zone (kept from their last
Heartbeat), which rolls over at their midnight. Legacy practice days are UTC
days and are imported as they are.
_Avoid_: Day (alone), UTC day

**Heartbeat**:
A report from the web that a User listened to a Track for some seconds. The API
credits it to the Practice day, at most 20 seconds per Heartbeat and never more
than its own clock saw pass since the User's previous Heartbeat.
_Avoid_: Ping, tick

**Daily target**:
How long a User wants to practice each Practice day: 5, 15 or 30 minutes.
Reaching it completes the day.
_Avoid_: Goal, quota

**Streak**:
The run of consecutive completed Practice days ending today, or yesterday while
today is still open.
_Avoid_: Series, chain

### Legacy

**Legacy ID**:
The ID a Track, Artist or Album had in the legacy app. It only exists to
resolve old URLs: a legacy ID map points it to the record's current ID, and
the old URL redirects there. Users have no Legacy ID: they keep the ID they
had in the legacy app.
_Avoid_: Old ID, external ID
