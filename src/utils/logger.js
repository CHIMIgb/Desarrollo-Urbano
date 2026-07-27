const isDev = typeof location !== 'undefined'
  ? (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  : false;

export const logger = {
  log: (...args) => isDev && console.log(...args),
  warn: (...args) => isDev && console.warn(...args),
  error: (...args) => console.error(...args),
};
