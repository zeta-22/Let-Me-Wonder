// The JavaScript the app puts into Instagram's page: the same filter as Safari's,
// told it's running inside the app and given the app's switches.

import filterBundle from '../filter/generated/filterBundle.js';

// Runs at page start. The filter ignores a second start, so it's safe to inject twice.
export function startScript(settings) {
  const config = JSON.stringify({ host: 'app', settings });
  return `window.__LMW_CONFIG__ = ${config};\n${filterBundle}\ntrue;`;
}

// Applies changed switches to the page that's already open.
export function settingsScript(settings) {
  return `window.__LMW__ && window.__LMW__.setSettings(${JSON.stringify(settings)}); true;`;
}

// Asks the filter for a problem report; it answers with a { type: 'report' } message.
export const REPORT_SCRIPT = `(function () {
  if (window.__LMW__) window.__LMW__.sendReport();
  else window.ReactNativeWebView.postMessage(JSON.stringify({ source: 'lmw', type: 'report',
    text: 'Let Me Wonder problem report\\nThe filter is not running on this page: ' + location.pathname }));
})(); true;`;
