import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone app wraps the same React build that runs on GitHub Pages (dist/).
// appId is the App Store bundle ID. It can be changed until the first upload, never after.
const config: CapacitorConfig = {
  appId: "com.pantryprep.app",
  appName: "Pantry Prep",
  webDir: "dist",
  backgroundColor: "#12382f",
  ios: {
    contentInset: "never",
    backgroundColor: "#12382f",
    // Lets the app scroll and bounce like a native screen, without the web view's own zoom.
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#12382f",
      showSpinner: false,
    },
    LocalNotifications: {
      iconColor: "#1D6F57",
    },
  },
};

export default config;
