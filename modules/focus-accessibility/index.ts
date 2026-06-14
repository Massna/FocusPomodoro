// Copyright 2015-present 650 Industries. All rights reserved.

import { NativeModules } from 'react-native';

export interface FocusAccessibilityNativeModule {
  setBlockingActive(active: boolean): Promise<void>;
  isServiceEnabled(): Promise<boolean>;
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
  if (!NativeModule) {
    console.warn('FocusAccessibilityModule is not available on this platform');
    return Promise.resolve();
  }
  return NativeModule.setBlockingActive(active);
}

export function isServiceEnabled(): Promise<boolean> {
  if (!NativeModule) {
    return Promise.resolve(false);
  }
  return NativeModule.isServiceEnabled();
}

export default NativeModule;
