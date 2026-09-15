'use strict';
const defaults = { music: true, effects: true, vibration: true, reducedMotion: false };
/** Toggle only a supported device setting, returning a new JSON snapshot without storage effects.
 * @param {object} progress @param {'music'|'effects'|'vibration'|'reducedMotion'} key @returns {object}
 */
function toggle(progress, key) {
  const next = JSON.parse(JSON.stringify(progress));
  if (Object.prototype.hasOwnProperty.call(defaults, key)) {
    next.settings = { ...defaults, ...next.settings };
    next.settings[key] = !next.settings[key];
  }
  return next;
}
module.exports = { toggle };
