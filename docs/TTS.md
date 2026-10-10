# Text-to-speech (patient interview)

Uses the browser `SpeechSynthesis` API (no external service, no API keys). Languages: English `en-IN`,
Hindi `hi-IN`, Marathi `mr-IN`, following the interface language.

## Behaviour

- Voices are detected on load and whenever the browser reports new voices (`voiceschanged`).
- Voice choice per language: exact locale, then language prefix (`mr`, `hi`), then a voice whose *name* says Marathi / Hindi.
- **Marathi without a Marathi voice:** read with a Hindi voice **and a visible notice** that pronunciation may differ.
- **Hindi or Marathi with no matching voice:** the question is **not** read aloud (an English voice would mispronounce it).
  A notice explains this and the patient continues by reading, touch or typing. Nothing blocks manual input.
- The notice is shown as soon as the language changes, before the patient presses *Listen*.
- Listen / Replay, Pause and Resume controls; starting playback cancels any playing speech first (no overlap);
  playback is cancelled on unmount and navigation.
- Speech playback state is separate from microphone (speech-to-text) state; *Listen* is disabled while the mic is listening.

## Compatibility — not verified on devices

Marathi / Hindi voices depend on the operating system and browser (for example Windows needs the language's speech
pack; many Android and Chrome OS devices include Hindi, while Marathi availability varies). Browser support was **not**
tested on physical kiosks; test on each target device before deployment and install voices where needed.
Optional external speech providers are not implemented.
