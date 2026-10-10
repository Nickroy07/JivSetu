"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Volume2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

type Language = "en" | "hi" | "mr";

interface VoiceInputProps {
  language: Language;
  onTranscript: (transcript: string) => void;
  onListeningChange?: (listening: boolean) => void;

  questionText?: string;
  options?: string[];
  autoSpeak?: boolean;
}

type SpeechRecognitionResultLike = {
  [index: number]: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  start(): void;
  stop(): void;
  abort(): void;

  onstart:
    | ((this: SpeechRecognitionLike, ev: Event) => void)
    | null;

  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;

  onerror:
    | ((event: SpeechRecognitionErrorEventLike) => void)
    | null;

  onend:
    | ((this: SpeechRecognitionLike, ev: Event) => void)
    | null;
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionLike;

export default function VoiceInput({
  language,
  onTranscript,
  onListeningChange,
  questionText = "",
  options = [],
  autoSpeak = true,
}: VoiceInputProps) {
  /*
   * ==========================================
   * REFS
   * ==========================================
   */

  const recognitionRef =
    useRef<SpeechRecognitionLike | null>(null);

  const speechRef =
    useRef<SpeechSynthesisUtterance | null>(null);

  const voicesRef =
    useRef<SpeechSynthesisVoice[]>([]);

  const questionKeyRef =
    useRef("");

  /*
   * ==========================================
   * STATE
   * ==========================================
   */

  const [isListening, setIsListening] =
    useState(false);

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  const [isPaused, setIsPaused] =
    useState(false);

  const [error, setError] =
    useState("");

  const [transcript, setTranscript] =
    useState("");

  const [voicesReady, setVoicesReady] =
    useState(false);

  const [voiceNotice, setVoiceNotice] =
    useState("");

  /*
   * ==========================================
   * LANGUAGE CODE
   * ==========================================
   */

  function languageCode(): string {
    switch (language) {
      case "hi":
        return "hi-IN";

      case "mr":
        return "mr-IN";

      default:
        return "en-IN";
    }
  }

  /*
   * ==========================================
   * LANGUAGE LABEL
   * ==========================================
   */

  function languageName(): string {
    switch (language) {
      case "hi":
        return "Hindi";

      case "mr":
        return "Marathi";

      default:
        return "English";
    }
  }

  /*
   * ==========================================
   * LOAD BROWSER VOICES
   * ==========================================
   *
   * Chrome may load voices asynchronously.
   *
   * Therefore we listen to voiceschanged.
   * ==========================================
   */

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    const loadVoices = () => {
      const voices =
        window.speechSynthesis.getVoices();

      voicesRef.current = voices;

      console.log(
        "[JIVSETU TTS] Available voices:",
        voices.map((voice) => ({
          name: voice.name,
          lang: voice.lang,
          localService:
            voice.localService,
        }))
      );

      setVoicesReady(true);
    };

    loadVoices();

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !voicesReady
    ) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from browser voices
    setVoiceNotice(resolveVoice(languageCode()).notice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, voicesReady]);

  /*
   * ==========================================
   * LISTENING STATE
   * ==========================================
   */

  function updateListening(
    value: boolean
  ) {
    setIsListening(value);

    onListeningChange?.(value);
  }

  /*
   * ==========================================
   * GET BEST VOICE
   * ==========================================
   *
   * Priority:
   *
   * 1. Exact language
   * 2. Language prefix
   * 3. Known Marathi/Hindi voice names
   * 4. Default browser voice
   *
   * ==========================================
   */

  function getBestVoice(
    lang: string
  ): SpeechSynthesisVoice | null {
    const voices =
      voicesRef.current.length > 0
        ? voicesRef.current
        : window.speechSynthesis.getVoices();

    if (!voices.length) {
      return null;
    }

    /*
     * Exact match.
     *
     * Example:
     * mr-IN
     */
    const exact =
      voices.find(
        (voice) =>
          voice.lang.toLowerCase() ===
          lang.toLowerCase()
      );

    if (exact) {
      return exact;
    }

    /*
     * Prefix match.
     *
     * Example:
     * mr
     */
    const prefix =
      lang.split("-")[0].toLowerCase();

    const prefixVoice =
      voices.find(
        (voice) =>
          voice.lang
            .toLowerCase()
            .startsWith(prefix)
      );

    if (prefixVoice) {
      return prefixVoice;
    }

    /*
     * Marathi-specific name matching.
     *
     * Some systems expose the language
     * differently but include Marathi
     * in the voice name.
     */
    if (lang === "mr-IN") {
      const marathiVoice =
        voices.find((voice) => {
          const value =
            `${voice.name} ${voice.lang}`
              .toLowerCase();

          return (
            value.includes("marathi") ||
            value.includes("mr-in")
          );
        });

      if (marathiVoice) {
        return marathiVoice;
      }
    }

    /*
     * Hindi-specific name matching.
     */
    if (lang === "hi-IN") {
      const hindiVoice =
        voices.find((voice) => {
          const value =
            `${voice.name} ${voice.lang}`
              .toLowerCase();

          return (
            value.includes("hindi") ||
            value.includes("hi-in")
          );
        });

      if (hindiVoice) {
        return hindiVoice;
      }
    }

    /*
     * English fallback.
     */
    if (lang === "en-IN") {
      const englishIndia =
        voices.find(
          (voice) =>
            voice.lang
              .toLowerCase() ===
            "en-in"
        );

      if (englishIndia) {
        return englishIndia;
      }
    }

    /*
     * Default browser voice.
     */
    const defaultVoice =
      voices.find(
        (voice) => voice.default
      );

    return (
      defaultVoice ||
      voices[0] ||
      null
    );
  }

  /*
   * Decide which voice may be used for a language and
   * whether the device can read it aloud at all.
   *
   * Reading Marathi or Hindi text with an English voice
   * produces unintelligible speech, so in that case we
   * do not speak and tell the user instead.
   */
  function resolveVoice(lang: string): {
    voice: SpeechSynthesisVoice | null;
    notice: string;
    canSpeak: boolean;
  } {
    const voices =
      voicesRef.current.length > 0
        ? voicesRef.current
        : window.speechSynthesis.getVoices();

    // Voices not loaded yet: let the browser decide.
    if (!voices.length) {
      return { voice: null, notice: "", canSpeak: true };
    }

    const prefix = lang.split("-")[0].toLowerCase();
    const nameMatch: Record<string, RegExp> = {
      mr: /marathi/i,
      hi: /hindi/i,
    };
    const forLanguage = (p: string) =>
      voices.find(
        (v) =>
          v.lang.toLowerCase().replace("_", "-").startsWith(p) ||
          nameMatch[p]?.test(v.name)
      );

    if (prefix === "en") {
      return { voice: getBestVoice(lang), notice: "", canSpeak: true };
    }

    const own = forLanguage(prefix);
    if (own) {
      return { voice: own, notice: "", canSpeak: true };
    }

    if (prefix === "mr") {
      const hindi = forLanguage("hi");
      if (hindi) {
        return {
          voice: hindi,
          notice:
            "A Marathi voice is not installed on this device. The question is read with a Hindi voice, so some pronunciation may differ.",
          canSpeak: true,
        };
      }
    }

    return {
      voice: null,
      notice: `A ${languageName()} voice is not installed on this device, so the question cannot be read aloud. You can read it on screen and answer by touch or typing.`,
      canSpeak: false,
    };
  }

  /*
   * ==========================================
   * BUILD TTS TEXT
   * ==========================================
   */

  function getOptionLabel(
    index: number
  ): string {
    switch (language) {
      case "hi":
        return `विकल्प ${index + 1}`;

      case "mr":
        return `पर्याय ${index + 1}`;

      default:
        return `Option ${index + 1}`;
    }
  }

  function buildSpeechText(): string {
    const question =
      questionText.trim();

    if (!question) {
      return "";
    }

    let text = question;

    const validOptions =
      options
        .map((option) =>
          String(option ?? "").trim()
        )
        .filter(Boolean);

    if (validOptions.length > 0) {
      if (language === "hi") {
        text += ". ";
        text += "आपके विकल्प हैं. ";

        validOptions.forEach(
          (option, index) => {
            text += `${getOptionLabel(
              index
            )}: ${option}. `;
          }
        );
      } else if (language === "mr") {
        text += ". ";
        text += "तुमचे पर्याय आहेत. ";

        validOptions.forEach(
          (option, index) => {
            text += `${getOptionLabel(
              index
            )}: ${option}. `;
          }
        );
      } else {
        text += ". ";
        text += "Your options are. ";

        validOptions.forEach(
          (option, index) => {
            text += `${getOptionLabel(
              index
            )}: ${option}. `;
          }
        );
      }
    }

    return text.trim();
  }

  /*
   * ==========================================
   * STOP TTS
   * ==========================================
   */

  function stopSpeaking() {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }

    speechRef.current = null;

    setIsSpeaking(false);
    setIsPaused(false);
  }

  /*
   * ==========================================
   * SPEAK
   * ==========================================
   */

  function speakQuestion() {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      setError(
        "Text-to-speech is not supported in this browser."
      );

      return;
    }

    const text =
      buildSpeechText();

    if (!text) {
      return;
    }

    const resolved = resolveVoice(languageCode());
    setVoiceNotice(resolved.notice);

    if (!resolved.canSpeak) {
      return;
    }

    /*
     * Cancel existing speech.
     */
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }

    setIsSpeaking(false);
    setIsPaused(false);

    /*
     * Wait for Chrome to process cancel().
     */
    window.setTimeout(() => {
      const utterance =
        new SpeechSynthesisUtterance(
          text
        );

      const lang =
        languageCode();

      /*
       * Set language explicitly.
       */
      utterance.lang = lang;

      /*
       * Select the best available voice.
       */
      const voice = resolved.voice;

      if (voice) {
        utterance.voice = voice;

        console.log(
          "[JIVSETU TTS] Using voice:",
          {
            name: voice.name,
            lang: voice.lang,
          }
        );
      } else {
        console.warn(
          `[JIVSETU TTS] No ${languageName()} voice found. Browser default will be used.`
        );
      }

      /*
       * Patient-friendly speed.
       */
      utterance.rate = 0.82;

      utterance.pitch = 1;

      utterance.volume = 1;

      /*
       * ========================================
       * TTS START
       * ========================================
       */

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setError("");
      };

      /*
       * ========================================
       * TTS END
       * ========================================
       */

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        speechRef.current = null;
      };

      /*
       * ========================================
       * TTS ERROR
       * ========================================
       */

      utterance.onerror = (
        event
      ) => {
        console.error(
          "[JIVSETU TTS] Error:",
          event
        );

        setIsSpeaking(false);
        setIsPaused(false);
        speechRef.current = null;

        /*
         * Don't show error for normal
         * cancellation.
         */
        if (
          event.error !==
          "canceled"
        ) {
          setError(
            `${languageName()} text-to-speech could not start. Please check the browser's installed speech voices.`
          );
        }
      };

      speechRef.current =
        utterance;

      try {
        window.speechSynthesis.speak(
          utterance
        );
      } catch (error) {
        console.error(
          "[JIVSETU TTS] Could not speak:",
          error
        );

        setIsSpeaking(false);
        setIsPaused(false);
        speechRef.current = null;

        setError(
          "Text-to-speech could not start."
        );
      }
    }, 100);
  }

  /*
   * ==========================================
   * PAUSE
   * ==========================================
   */

  function pauseSpeaking() {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    if (
      window.speechSynthesis.speaking &&
      !window.speechSynthesis.paused
    ) {
      window.speechSynthesis.pause();

      setIsPaused(true);
    }
  }

  /*
   * ==========================================
   * RESUME
   * ==========================================
   */

  function resumeSpeaking() {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    if (
      window.speechSynthesis.paused
    ) {
      window.speechSynthesis.resume();

      setIsPaused(false);
    }
  }

  /*
   * ==========================================
   * AUTO SPEAK
   * ==========================================
   */

  useEffect(() => {
    if (
      !autoSpeak ||
      !questionText.trim()
    ) {
      return;
    }

    /*
     * Prevent same question from being
     * spoken repeatedly.
     */
    const questionKey =
      `${language}|${questionText}|${options.join("|")}`;

    if (
      questionKeyRef.current ===
      questionKey
    ) {
      return;
    }

    questionKeyRef.current =
      questionKey;

    /*
     * Don't speak while listening.
     */
    if (isListening) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        speakQuestion();
      }, 700);

    return () => {
      window.clearTimeout(timer);

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }

      setIsSpeaking(false);
      setIsPaused(false);
    };
  }, [
    questionText,
    language,
    autoSpeak,
  ]);

  /*
   * ==========================================
   * START STT
   * ==========================================
   */

  function startListening() {
    setError("");
    setTranscript("");

    if (
      typeof window === "undefined"
    ) {
      return;
    }

    /*
     * Stop TTS first.
     */
    stopSpeaking();

    const speechWindow =
      window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

    const SpeechRecognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice input is not supported in this browser. Please use Google Chrome."
      );

      return;
    }

    /*
     * Stop previous recognition.
     */
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }

      recognitionRef.current =
        null;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang =
      languageCode();

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    recognition.maxAlternatives =
      1;

    /*
     * ========================================
     * START
     * ========================================
     */

    recognition.onstart = () => {
      updateListening(true);

      setError("");
    };

    /*
     * ========================================
     * RESULT
     * ========================================
     */

    recognition.onresult = (
      event: SpeechRecognitionEventLike
    ) => {
      const result =
        event.results?.[0]?.[0]
          ?.transcript || "";

      const cleaned =
        result.trim();

      if (!cleaned) {
        return;
      }

      setTranscript(cleaned);

      onTranscript(cleaned);
    };

    /*
     * ========================================
     * ERROR
     * ========================================
     */

    recognition.onerror = (
      event: SpeechRecognitionErrorEventLike
    ) => {
      console.error(
        "[JIVSETU STT] Error:",
        event.error
      );

      updateListening(false);

      switch (event.error) {
        case "not-allowed":
          setError(
            "Microphone permission was denied. Please allow microphone access in Chrome."
          );
          break;

        case "no-speech":
          setError(
            "I couldn't hear you. Please tap Speak and try again."
          );
          break;

        case "audio-capture":
          setError(
            "No microphone was detected. Please check your microphone."
          );
          break;

        case "network":
          setError(
            "Voice recognition needs a network connection. Please check your internet connection."
          );
          break;

        case "aborted":
          break;

        default:
          setError(
            "Voice recognition failed. Please try again."
          );
      }

      recognitionRef.current =
        null;
    };

    /*
     * ========================================
     * END
     * ========================================
     */

    recognition.onend = () => {
      updateListening(false);

      recognitionRef.current =
        null;
    };

    recognitionRef.current =
      recognition as SpeechRecognitionLike;

    /*
     * ========================================
     * START MICROPHONE
     * ========================================
     */

    try {
      recognition.start();
    } catch (error) {
      console.error(
        "[JIVSETU STT] Could not start:",
        error
      );

      updateListening(false);

      setError(
        "Could not start the microphone. Please try again."
      );

      recognitionRef.current =
        null;
    }
  }

  /*
   * ==========================================
   * STOP STT
   * ==========================================
   */

  function stopListening() {
    const recognition =
      recognitionRef.current;

    if (!recognition) {
      return;
    }

    try {
      recognition.stop();
    } catch {
      // Ignore
    }
  }

  /*
   * ==========================================
   * CLEANUP
   * ==========================================
   */

  useEffect(() => {
    return () => {
      /*
       * Stop recognition.
       */
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }

        recognitionRef.current =
          null;
      }

      /*
       * Stop speech.
       */
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  /*
   * ==========================================
   * UI
   * ==========================================
   */

  return (
    <div className="flex w-full flex-col items-center gap-5">

      {/* ====================================
          TTS
          ==================================== */}

      {questionText.trim() && (
        <div className="w-full rounded-2xl border border-[var(--border)] bg-white p-5">

          {/* Header */}

          <div className="mb-4 flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)]/10">

              <Volume2
                size={23}
                className="text-[var(--primary)]"
              />

            </div>

            <div>

              <p className="font-bold">
                Listen to the question
              </p>

              <p className="text-sm text-[var(--muted)]">
                Question and options will be
                read aloud
              </p>

            </div>

          </div>

          {/* Controls */}

          <div className="flex flex-wrap gap-3">

            {/* Listen / Replay */}

            <button
              type="button"
              onClick={
                speakQuestion
              }
              disabled={isListening}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-5 font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {isSpeaking ? (
                <RotateCcw
                  size={20}
                />
              ) : (
                <Volume2
                  size={20}
                />
              )}

              {isSpeaking
                ? "Replay"
                : "Listen"}

            </button>

            {/* Pause */}

            {isSpeaking &&
              !isPaused && (
                <button
                  type="button"
                  onClick={
                    pauseSpeaking
                  }
                  className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-5 font-semibold transition hover:bg-gray-50"
                >

                  <Pause
                    size={20}
                  />

                  Pause

                </button>
              )}

            {/* Resume */}

            {isSpeaking &&
              isPaused && (
                <button
                  type="button"
                  onClick={
                    resumeSpeaking
                  }
                  className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-5 font-semibold transition hover:bg-gray-50"
                >

                  <Play
                    size={20}
                  />

                  Resume

                </button>
              )}

          </div>

          {voiceNotice && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {voiceNotice}
            </p>
          )}

          {/* Speaking status */}

          {isSpeaking && (
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">

              <Volume2
                size={18}
              />

              <span>
                Jivsetu is reading the question
                and options...
              </span>

            </div>
          )}

          {/* Options */}

          {options.length > 0 && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4">

              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                Available options
              </p>

              <div className="space-y-2">

                {options.map(
                  (option, index) => (
                    <div
                      key={`${index}-${option}`}
                      className="flex items-start gap-3"
                    >

                      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                        {index + 1}
                      </span>

                      <span className="text-sm">
                        {option}
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

        </div>
      )}

      {/* ====================================
          STT
          ==================================== */}

      <div className="flex w-full flex-col items-center gap-4">

        <button
          type="button"
          onClick={
            isListening
              ? stopListening
              : startListening
          }
          className={`flex min-h-20 min-w-[180px] items-center justify-center gap-3 rounded-2xl px-8 text-xl font-bold transition-all ${
            isListening
              ? "bg-red-100 text-red-700 ring-4 ring-red-200"
              : "bg-[var(--primary)] text-white hover:scale-[1.03]"
          }`}
        >

          {isListening ? (
            <>
              <Square
                size={26}
              />

              Stop
            </>
          ) : (
            <>
              <Mic
                size={30}
              />

              Speak
            </>
          )}

        </button>

        {isListening && (
          <div className="text-center">

            <p className="text-lg font-bold text-[var(--primary)]">
              Listening...
            </p>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Please speak your answer
            </p>

          </div>
        )}

        {!isListening &&
          transcript && (
            <div className="w-full rounded-xl border border-[var(--border)] bg-white p-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                You said
              </p>

              <p className="mt-2 text-lg font-medium">
                {transcript}
              </p>

            </div>
          )}

        {error && (
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-700">
            {error}
          </div>
        )}

      </div>

    </div>
  );
}