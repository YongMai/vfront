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
