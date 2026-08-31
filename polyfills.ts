import { Platform } from 'react-native';
import structuredClone from '@ungap/structured-clone';

// O AI SDK pede structuredClone e Text*Stream. No Expo isso só existe na web.
if (Platform.OS !== 'web') {
  const configurarPolyfills = async () => {
    const { polyfillGlobal } = await import(
      'react-native/Libraries/Utilities/PolyfillFunctions'
    );
    const { TextEncoderStream, TextDecoderStream } = await import(
      '@stardazed/streams-text-encoding'
    );

    if (!('structuredClone' in global)) {
      polyfillGlobal('structuredClone', () => structuredClone);
    }
    polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
    polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
  };

  configurarPolyfills();
}

export {};
