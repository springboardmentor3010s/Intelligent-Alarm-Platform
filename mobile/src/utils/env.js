// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Runtime-environment helpers.
 */
import Constants from 'expo-constants';

/**
 * True when running inside the Expo Go client.
 *
 * `executionEnvironment === 'storeClient'` is the reliable SDK 53+ signal
 * (`appOwnership` is deprecated); the `expo` helper is kept as a fallback for
 * older runtimes.
 */
export function isExpoGo() {
  try {
    if (Constants?.executionEnvironment === 'storeClient') return true;
    const { isRunningInExpoGo } = require('expo');
    if (typeof isRunningInExpoGo === 'function') return isRunningInExpoGo();
  } catch (e) {
    // fall through to false
  }
  return false;
}

export default { isExpoGo };
