import { useEffect, useState } from 'react';
import { isMobile, isSafari } from 'react-device-detect';

export default function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const defaultVoice = voices.find(
    (voice) => voice.default && voice.lang.startsWith('en-'),
  );

  // Display voices when they become available
  useEffect(() => {
    const updateVoiceSettings = () => {
      const newVoices = window.speechSynthesis.getVoices();
      setVoices(newVoices);
    };

    // Safari doesn't support `voiceschanged` event, so we have to
    // periodically check if voices are loaded.
    // So is any mobile browser on iOS.
   if (isSafari || isMobile) {
  const checkVoices = () => {
    const newVoices = window.speechSynthesis.getVoices();
    if (newVoices.length > 0) {
      updateVoiceSettings();
    } else {
      // Schedule the next check only if the previous check didn't find any voices
      setTimeout(checkVoices, 100);
    }
  };

  // Initiate the first check
  checkVoices();

  // Stop checking after 10 seconds
  const timeoutId = setTimeout(() => {
    // Overwrite the checkVoices function to prevent further checks
    checkVoices = () => {};
  }, 10_000);

  return () => clearTimeout(timeoutId);
}


    window.speechSynthesis.addEventListener(
      'voiceschanged',
      updateVoiceSettings,
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        updateVoiceSettings,
      );
    };
  }, []);

  return { voices, defaultVoice };
}
