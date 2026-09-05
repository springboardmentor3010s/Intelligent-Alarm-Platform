# expo-react-native-expert

## Purpose & Use Case
React Native project initialization for Expo (targeting Android with Expo Go support), offline puzzle cache schemas, and Android optimization. Enables rapid mobile development with live testing via Expo Go.

## Rules & Standard Workflows
1. **Expo Go Setup**: Initialize project with `expo init` or `create-expo-app`. Configure `app.json` with `expo.android.packageName` and `expo.android.versionCode`/`VersionName`. Ensure `expo-start` works with `expo go` on physical devices.
2. **Offline Puzzle Cache**: Store downloaded cognitive challenges in `AsyncStorage` with expiration timestamps. Cache key format: `puzzle:{challengeId}:{version}`. Implement cache invalidation on app startup by comparing server version hashes.
3. **Android Optimization**: Configure `android/app/build.gradle` with `minSdkVersion 21`, `targetSdkVersion 34`. Enable `split` for armeabi-v7a, arm64-v8a, x86, x86_64. Use `expo-config-plugins` for native module patches.
4. **Local Development Workflow**: `expo start -c` for Chrome DevTools, `expo start --android` for direct Android emulator launch. Use `expo docteur` to diagnose environment issues before debugging.
5. **Environment Variables**: Store API endpoints and feature flags in `env.gradle` (Android) and `env.ts` (TypeScript). Never hardcode production URLs in JavaScript.

## Best Practices & Guardrails
- Use TypeScript for all new RN code; enforce `strict: true` in `tsconfig.json`.
- Wrap all native module calls in `try...catch` blocks with user-friendly error messages.
- Optimize images with `expo-image` and configure `maxWidth`/`maxHeight` to reduce bundle size.
- Run `expo fetch:originals` regularly to keep Expo-go compatible with SDK version.
- Add `metro.config.js` for custom resolution thresholds if dealing with large puzzle asset bundles.

## Skill Invocation
- Trigger when: a user says "setup Expo project", "fix Android build", or "optimize puzzle cache".
- Response must include: Expo Go workflow, AsyncStorage cache pattern, and Android config reference.