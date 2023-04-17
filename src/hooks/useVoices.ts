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
      let interval = setInterval(() => {
       
const newVoices = window.speechSynthesis.getVoices();
const updateVoiceSettingss = () => {
  const newVoices = window.speechSynthesis.getVoices();
  if (newVoices.length > 0) {
    setVoices([newVoices[0]]);
  }
};
if (newVoices.length > 0) {
  clearInterval(interval);
  updateVoiceSettingss(); // Pass only the first voice
  window.speechSynthesis.addEventListener('voiceschanged', updateVoiceSettingss);
}
else{
          window.speechSynthesis.removeEventListener(
            'voiceschanged',
            updateVoiceSettingss,
          );
        }
      }, 100);
      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(interval), 10_000);

      return () => clearInterval(interval); 
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
