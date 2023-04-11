import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSpeechRecognition } from 'react-speech-recognition';
import {
  GitHub,
  Settings,
  Trash,
  Mic,
  Activity,
  Loader,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Headphones,
  Info,
  Trash2,
  Link,
  ExternalLink,
} from 'react-feather';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';
import * as Slider from '@radix-ui/react-slider';
import * as Select from '@radix-ui/react-select';
import { isDesktop, isMobile } from 'react-device-detect';

import Button from './design_system/Button';
import SyntaxHighlighter from './design_system/SyntaxHighlighter';
import Message from './design_system/Message';
import API from './lib/api';
import Config from './lib/config';
import Storage from './lib/storage';
import Voice from './lib/voice';
import useVoices from './hooks/useVoices';

interface CreateChatGPTMessageResponse {
  answer: string;
  messageId: string;
}

interface Message {
  type: 'prompt' | 'response';
  text: string;
}

interface VoiceMappings {
  [group: string]: SpeechSynthesisVoice[];
}

enum State {
  IDLE,
  LISTENING,
  PROCESSING,
}

const savedData = Storage.load();

function App() {
  const {
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    transcript,
    listening,
    finalTranscript,
  } = useSpeechRecognition();

  const initialMessages: Message[] = [
    { type: 'response', text: 'Try speaking to the microphone.' },
  ];
  const defaultSettingsRef = useRef({
    host: 'http://localhost',
    port: 8000,
    voiceURI: '',
    voiceSpeed: 1,
  });
  const [state, setState] = useState(State.IDLE);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [settings, setSettings] = useState({
    host: (savedData?.host as string) ?? defaultSettingsRef.current.host,
    port: (savedData?.port as number) ?? defaultSettingsRef.current.port,
    voiceURI:
      (savedData?.voiceURI as string) ?? defaultSettingsRef.current.voiceURI,
    voiceSpeed:
      (savedData?.voiceSpeed as number) ??
      defaultSettingsRef.current.voiceSpeed,
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(
    Config.IS_LOCAL_SETUP_REQUIRED,
  );
  const { voices, defaultVoice } = useVoices();
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef({ currentMessageId: '' });
  const bottomDivRef = useRef<HTMLDivElement>(null);

  const availableVoices = useMemo(() => {
    const englishTypes = new Map();
    englishTypes.set('en-AU', 'English (Australia)');
    englishTypes.set('en-CA', 'English (Canada)');
    englishTypes.set('en-GB', 'English (United Kingdom)');
    englishTypes.set('en-IE', 'English (Ireland)');
    englishTypes.set('en-IN', 'English (India)');
    englishTypes.set('en-NZ', 'English (New Zealand)');
    englishTypes.set('en-US', 'English (United State)');

    const localEnglishVoices = voices.filter(
      (voice) => voice.localService && voice.lang.startsWith('en-'),
    );

    const result: VoiceMappings = {};
    for (let voice of localEnglishVoices) {
      const label = englishTypes.get(voice.lang);
      if (typeof label !== 'string') {
        continue;
      }
      if (!result[label]) {
        result[label] = [];
      }
      result[label].push(voice);
    }
    return result;
  }, [voices]);

  const selectedVoice = useMemo(() => {
    return voices.find((voice) => voice.voiceURI === settings.voiceURI);
  }, [voices, settings.voiceURI]);

  const recognizeSpeech = () => {
    if (state === State.IDLE) {
      Voice.enableAutoplay();
      Voice.startListening();
    } else if (state === State.LISTENING) {
      Voice.stopListening();
    }
  };

  const speak = useCallback(
    (text: string) => {
      Voice.speak(text, { voice: selectedVoice, rate: settings.voiceSpeed });
    },
    [selectedVoice, settings.voiceSpeed],
  );

  const resetConversation = () => {
    setState(State.IDLE);
    setMessages(initialMessages);
    conversationRef.current = { currentMessageId: '' };

    Voice.idle();
    abortRef.current?.abort();
  };

  const handleModalOpenChange = (isOpen: boolean) => {
    setIsModalVisible(isOpen);
    Storage.save(settings);
  };

  const resetSetting = (setting: keyof typeof settings) => {
    setSettings({
      ...settings,
      [setting]: defaultSettingsRef.current[setting],
    });
  };

  useEffect(() => {
    setState((oldState) => {
      if (listening) {
        return State.LISTENING;
      }
      if (
        (oldState === State.LISTENING && transcript) || // At this point finalTranscript may not have a value yet
        oldState === State.PROCESSING // Avoid setting state to IDLE when transcript is set to '' while processing
      ) {
        return State.PROCESSING;
      }
      return State.IDLE;
    });
  }, [listening, transcript, finalTranscript]);

  // Scroll to bottom when user is speaking a prompt
  useEffect(() => {
    if (state === State.LISTENING) {
      bottomDivRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state]);

  // Scroll to bottom when there is a new response
  useEffect(() => {
    bottomDivRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!defaultVoice) {
      return;
    }

    defaultSettingsRef.current.voiceURI = defaultVoice.voiceURI;
    setSettings((oldSettings) => {
      // If a preferred voice is already set, keep it
      if (oldSettings.voiceURI) {
        return oldSettings;
      }
      return {
        ...oldSettings,
        voiceURI: defaultVoice.voiceURI,
      };
    });
  }, [defaultVoice]);

  useEffect(() => {
    if (state !== State.PROCESSING || !finalTranscript) {
      return;
    }

    setMessages((oldMessages) => [
      ...oldMessages,
      { type: 'prompt', text: finalTranscript },
    ]);

    async function handleSendMessage() {
    
      const host = Config.IS_LOCAL_SETUP_REQUIRED
        ? `${settings.host}:${settings.port}`
        : Config.API_HOST;
    
      const { response, abortController, data } = await API.sendMessage(host, {
        text: finalTranscript,
        parentMessageId: conversationRef.current.currentMessageId || undefined,
      });
    
    
      if (data) {
        conversationRef.current.currentMessageId = data.messageId;
        setMessages((oldMessages) => [
          ...oldMessages,
          { type: 'response', text: data.answer },
        ]);
        speak(data.answer);
      } else {
        let responseText: string;
    
        
          responseText = 'Failed to get the response, please try again.';
      
    
        setMessages((oldMessages) => [
          ...oldMessages,
          { type: 'response', text: responseText },
        ]);
        speak(responseText);
      }
    
      setState(State.IDLE);
    }
    
    
      handleSendMessage();
    }, [state, finalTranscript, settings, speak]);
    
    

  if (!browserSupportsSpeechRecognition) {
    return (
      <div>
        This browser doesn't support speech recognition. Please use Chrome.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-8 py-9 flex flex-col h-screen gap-y-4 lg:px-28 lg:py-12 lg:relative">
      <header className="flex flex-col items-center lg:flex-row lg:justify-between lg:mb-4">
        {/* w-64 so text will break after ChatGPT */}
        <h1 className="font-title text-3xl text-center w-64 lg:w-auto">
          语音版ChatGPT
          <div className="inline-block w-4 h-7 ml-2 align-middle bg-dark/40 animate-blink" />
        </h1>
        <div className="mt-4 flex justify-center lg:px-2">
          <a href="https://yongmai.xyz" target="_blank">
            <ExternalLink strokeWidth={1} />
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-y-4 overflow-y-auto lg:mr-80 lg:gap-y-8">
        {messages.map(({ type, text }, index) => {
          const getIsActive = () => {
            switch (state) {
              case State.IDLE: {
                if (type === 'prompt') {
                  return index === messages.length - 2;
                } else if (type === 'response') {
                  return index === messages.length - 1;
                }
                return false;
              }

              case State.LISTENING:
                return false;

              case State.PROCESSING:
                return type === 'prompt' && index === messages.length - 1;

              default:
                return false;
            }
          };
          return (
            <Message
              key={text}
              type={type}
              text={text}
              isActive={getIsActive()}
              onClick={speak}
            />
          );
        })}
        {state === State.LISTENING && (
          <Message type="prompt" text={transcript} isActive />
        )}
        <div ref={bottomDivRef} />
      </main>

      <div>
        <div className="lg:absolute lg:right-28 lg:bottom-12 lg:w-72">
          {!isMicrophoneAvailable && (
            <div className="flex gap-x-3 mb-6 text-danger">
              <div className="shrink-0">
                <AlertTriangle strokeWidth={1} />
              </div>
              <div>
                Please allow microphone permission for this app to work
                properly.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center items-center gap-x-8 lg:flex-col lg:gap-y-8 lg:absolute lg:top-1/2 lg:right-28 lg:-translate-y-1/2">
          <div>
            {/**
             * We want a tooltip that positions itself against the Settings button.
             * However, we don't want the tooltip to display each time we hover on it.
             * So, an invisible div that is right on top of the Settings button is
             * used here as the tooltip's target.
             */}
            <Tooltip.Provider delayDuration={0}>
              <Tooltip.Root
                open={isTooltipVisible}
                onOpenChange={setIsTooltipVisible}
              >
                <Tooltip.Trigger asChild>
                  <div />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="rounded-md px-4 py-3 max-w-xs bg-light border border-dark shadow-solid select-none animate-fade-in"
                    sideOffset={isMobile ? 15 : 10}
                    align={isMobile ? 'start' : 'end'}
                    alignOffset={isMobile ? -50 : 0}
                  >
                    {isMobile
                      ? 'Run a local server on Desktop to see this works.'
                      : 'Set up local server first.'}
                    <Tooltip.Arrow className="fill-light relative -top-px" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>

            <Button
              aria-label="Settings"
              onClick={() => setIsModalVisible(true)}
            >
              <Settings strokeWidth={1} />
            </Button>
          </div>

          <button
            type="button"
            className={`w-16 h-16 ${
              state === State.IDLE
                ? 'bg-dark'
                : state === State.LISTENING
                ? 'bg-accent1'
                : state === State.PROCESSING
                ? 'bg-accent2'
                : ''
            } text-light flex justify-center items-center rounded-full transition-all hover:opacity-80 focus:opacity-80`}
            onClick={recognizeSpeech}
            disabled={state === State.PROCESSING}
            aria-label={
              state === State.IDLE
                ? 'Start speaking'
                : state === State.LISTENING
                ? 'Listening'
                : state === State.PROCESSING
                ? 'Processing'
                : ''
            }
          >
            {state === State.IDLE ? (
              <Mic strokeWidth={1} size={32} />
            ) : state === State.LISTENING ? (
              <div className="animate-blink">
                <Activity strokeWidth={1} size={32} />
              </div>
            ) : state === State.PROCESSING ? (
              <div className="animate-spin-2">
                <Loader strokeWidth={1} size={32} />
              </div>
            ) : null}
          </button>

          <Button aria-label="New conversation" onClick={resetConversation}>
            <Trash2 strokeWidth={1} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;
