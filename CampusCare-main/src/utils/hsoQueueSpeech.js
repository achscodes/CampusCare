/**
 * Native Web Speech API only (SpeechSynthesisUtterance).
 * Starts playback synchronously so Chrome keeps the user-gesture activation when called from click handlers.
 */

const PAUSE_MS_BETWEEN_REPEATS = 450;

/** Optional: call from a tap/click on the queue display before announcements (helps some browsers). */
export function primeSpeechSynthesis() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.resume();
    void window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
}

const FEMALE_VOICE_HINTS = [
  "female",
  "woman",
  "girl",
  "zira",
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "susan",
  "linda",
  "allison",
  "ava",
  "joanna",
  "salli",
  "kimberly",
  "kendra",
  "amy",
  "emma",
  "olivia",
  "sophie",
  "google us english",
  "google uk english female",
];

function isFemaleVoice(v) {
  const haystack = `${v?.name || ""} ${v?.voiceURI || ""}`.toLowerCase();
  return FEMALE_VOICE_HINTS.some((hint) => haystack.includes(hint));
}

function pickEnglishVoice() {
  const voices =
    typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const enVoices = voices.filter((v) => /^en(-|$)/i.test(v.lang || ""));
  return (
    enVoices.find((v) => v.lang === "en-US" && isFemaleVoice(v)) ||
    enVoices.find((v) => isFemaleVoice(v)) ||
    voices.find((v) => isFemaleVoice(v)) ||
    enVoices.find((v) => v.lang === "en-US") ||
    enVoices[0] ||
    voices[0] ||
    null
  );
}

function attachVoice(u) {
  const voice = pickEnglishVoice();
  if (voice) u.voice = voice;
  u.lang = "en-US";
  u.rate = 1;
  u.pitch = 1.05;
  u.volume = 1;
}

/**
 * Speak queue text. First utterance starts in the current synchronous turn (important for click handlers).
 * @param {string} text
 * @param {{ repeats?: number }} [opts]
 * @returns {Promise<void>}
 */
export function speakQueueAnnouncement(text, opts = {}) {
  const { repeats = 1 } = opts;
  const msg = String(text || "").trim();
  if (!msg) return Promise.resolve();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }

  const n = Math.max(1, Math.min(5, Math.floor(Number(repeats)) || 1));

  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    let completed = 0;

    const playNext = () => {
      const u = new SpeechSynthesisUtterance(msg);
      attachVoice(u);
      const advance = () => {
        completed += 1;
        if (completed >= n) resolve();
        else window.setTimeout(playNext, PAUSE_MS_BETWEEN_REPEATS);
      };
      u.onend = advance;
      u.onerror = advance;
      window.speechSynthesis.speak(u);
    };

    playNext();
  });
}
