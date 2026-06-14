import { NativeModules } from 'react-native';

export interface FocusAccessibilityNativeModule {
  setBlockingActive(active: boolean): Promise<void>;
  isServiceEnabled(): Promise<boolean>;
  getInstalledApps(): Promise<Array<{ packageName: string; appName: string }>>;
  requestAccessibilityPermission(): Promise<void>;
  updateBlockedApps(packages: string[]): void;
  setOneTimePassword(password: string | null, durationMinutes: number): void;
  verifyOneTimeUnlock(password: string): boolean;
  clearOneTimeUnlock(): void;
}

function requireNativeModule<T extends FocusAccessibilityNativeModule>(moduleName: string): T | null {
  const turboProxy = (global as any).__turboModuleProxy;
  if (turboProxy != null) {
    const turboModule = turboProxy(moduleName);
    if (turboModule != null) return turboModule as T;
  }
  const legacyModule = NativeModules[moduleName];
  return legacyModule ? (legacyModule as T) : null;
}

const NativeModule = requireNativeModule<FocusAccessibilityNativeModule>('FocusAccessibilityModule');

export function setBlockingActive(active: boolean): Promise<void> {
  if (!NativeModule) { console.warn('FocusAccessibilityModule not available'); return Promise.resolve(); }
  return NativeModule.setBlockingActive(active);
}

export function isServiceEnabled(): Promise<boolean> {
  if (!NativeModule) return Promise.resolve(false);
  return NativeModule.isServiceEnabled();
}

export function getInstalledApps(): Promise<Array<{ packageName: string; appName: string }>> {
  if (!NativeModule) return Promise.resolve([]);
  return NativeModule.getInstalledApps();
}

export function requestAccessibilityPermission(): Promise<void> {
  if (!NativeModule) { console.warn('FocusAccessibilityModule not available'); return Promise.resolve(); }
  return NativeModule.requestAccessibilityPermission();
}

export function updateBlockedApps(packages: string[]): void {
  if (!NativeModule) return;
  NativeModule.updateBlockedApps(packages);
}

export function setOneTimePassword(password: string | null, durationMinutes: number): void {
  if (!NativeModule) return;
  NativeModule.setOneTimePassword(password, durationMinutes);
}

export function verifyOneTimeUnlock(password: string): boolean {
  if (!NativeModule) return false;
  return NativeModule.verifyOneTimeUnlock(password);
}

export function clearOneTimeUnlock(): void {
  if (!NativeModule) return;
  NativeModule.clearOneTimeUnlock();
}

export default NativeModule;
