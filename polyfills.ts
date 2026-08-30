import { Platform } from 'react-native';
import structuredClone from '@ungap/structured-clone';

/**
 * O AI SDK depende de APIs de streaming ausentes no runtime do Expo fora da web.
 * Só entra aqui — nunca antes, para que um polyfill quebrado não vire o pior
 * momento de descoberta no meio do desenvolvimento da interface.
 */
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
