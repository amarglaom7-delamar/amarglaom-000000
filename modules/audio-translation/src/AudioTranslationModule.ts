import { EventEmitter, requireOptionalNativeModule } from 'expo-modules-core';

type SpeechResultEvent = {
  text?: string;
  language?: string;
};

type TranslationStateEvent = {
  state?: string;
  message?: string;
};

const AudioTranslationModule = requireOptionalNativeModule<any>('MiniWaveAudioTranslation');

const fallbackEvents = {
  addListener: () => ({ remove() {} }),
};

export const audioTranslationEvents = AudioTranslationModule
  ? new EventEmitter(AudioTranslationModule)
  : fallbackEvents;

const fallbackModule = {
  start: async () => {},
  stop: () => {},
};

export default AudioTranslationModule ?? fallbackModule;

export type { SpeechResultEvent, TranslationStateEvent };
