import { EventEmitter, requireNativeModule } from 'expo-modules-core';

type SpeechResultEvent = {
  text?: string;
  language?: string;
};

type TranslationStateEvent = {
  state?: string;
  message?: string;
};

const AudioTranslationModule = requireNativeModule('MiniWaveAudioTranslation');

export const audioTranslationEvents = new EventEmitter(AudioTranslationModule);
export default AudioTranslationModule;

export type { SpeechResultEvent, TranslationStateEvent };
