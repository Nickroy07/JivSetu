"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type VoiceInputLanguage = "en" | "hi" | "mr" | "en-IN" | "hi-IN" | "mr-IN";

interface VoiceInputProps {
  language: VoiceInputLanguage;
  onTranscript: (transcript: string) => void;
  onListeningChange?: (listening: boolean) => void;
}

const languageCodes: Record<VoiceInputLanguage, "en-IN" | "hi-IN" | "mr-IN"> = {
  en: "en-IN", hi: "hi-IN", mr: "mr-IN", "en-IN": "en-IN", "hi-IN": "hi-IN", "mr-IN": "mr-IN",
};

function getErrorMessage(error: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed": return "Microphone permission was denied. Allow microphone access in your browser settings, then try again.";
    case "no-speech": return "No speech was detected. Please try again and speak after listening starts.";
    case "audio-capture": return "No microphone was found. Connect or enable a microphone, then try again.";
    case "network": return "Voice recognition needs a network connection. Check your connection and try again.";
    case "language-not-supported": return "This browser does not support voice recognition for the selected language. Please type your answer instead.";
    default: return "Voice recognition could not start. Please try again or type your answer instead.";
  }
}

export default function VoiceInput({ language, onTranscript, onListeningChange }: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mountedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  const onListeningChangeRef = useRef(onListeningChange);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Voice input is ready.");

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onListeningChangeRef.current = onListeningChange;
  }, [onListeningChange, onTranscript]);

  function updateListening(listening: boolean) {
    if (!mountedRef.current) return;
    setIsListening(listening);
    onListeningChangeRef.current?.(listening);
  }

  function disposeRecognition(recognition: SpeechRecognition, abort = true) {
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    if (abort) {
      try { recognition.abort(); } catch { /* Recognition may already have ended. */ }
    }
  }

  useEffect(() => {
    const supportCheck = window.setTimeout(() => {
      const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognitionConstructor));
      if (!SpeechRecognitionConstructor) {
        setStatus("Voice input is unavailable. You can still type your answer.");
        setError("Voice input is not supported in this browser. Please type your answer or use a browser that supports the Web Speech API.");
      }
    }, 0);
    return () => window.clearTimeout(supportCheck);
  }, []);

  function startListening() {
    const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setIsSupported(false);
      setStatus("Voice input is unavailable. You can still type your answer.");
      setError("Voice input is not supported in this browser. Please type your answer or use a browser that supports the Web Speech API.");
      return;
    }

    if (recognitionRef.current) {
      disposeRecognition(recognitionRef.current);
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = languageCodes[language];
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      updateListening(true);
      setError("");
      setStatus("Listening. Speak your answer, then tap Stop when you are finished.");
    };
    recognition.onresult = (event) => {
      const nextTranscript = event.results[event.resultIndex]?.[0]?.transcript.trim() ?? "";
      if (!nextTranscript) return;
      setTranscript(nextTranscript);
      onTranscriptRef.current(nextTranscript);
      setStatus("Voice input stopped. Your transcript is shown below.");
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(getErrorMessage(event.error));
        setStatus("Voice input stopped because of an error.");
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      updateListening(false);
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setError("");
    setStatus("Starting voice input...");
    try {
      recognition.start();
    } catch {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      updateListening(false);
      setError("Voice recognition could not start. Check microphone access and try again, or type your answer instead.");
      setStatus("Voice input stopped because it could not start.");
    }
  }

  function stopListening() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setStatus("Stopping voice input...");
    try {
      recognition.stop();
    } catch {
      disposeRecognition(recognition, false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      updateListening(false);
      setStatus("Voice input stopped.");
    }
  }

  useEffect(() => () => {
    mountedRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) disposeRecognition(recognition);
    recognitionRef.current = null;
    onListeningChangeRef.current?.(false);
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          disabled={isSupported === false}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={isListening}
          aria-describedby="voice-input-status"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isListening ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          {isListening ? "Stop listening" : "Use voice input"}
        </button>
        <p id="voice-input-status" role="status" aria-live="polite" className="text-sm text-slate-600">{status}</p>
      </div>
      {transcript && (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">You said</p>
          <p className="mt-1 text-sm text-slate-800">{transcript}</p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
