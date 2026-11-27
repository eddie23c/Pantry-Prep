// True inside the iPhone app (Capacitor), false on the website. Kept tiny so the web build
// can check it without loading any native code.
import { Capacitor } from "@capacitor/core";

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
