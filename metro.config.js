const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const tslibEs6 = require.resolve('tslib/tslib.es6.js');
const resolvePadrao = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return { filePath: tslibEs6, type: 'sourceFile' };
  }

  if (resolvePadrao) {
    return resolvePadrao(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
