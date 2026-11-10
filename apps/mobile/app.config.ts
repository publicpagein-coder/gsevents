import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "GSEvents",
  slug: "gsevents",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ea580c",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.gsevents.app",
  },
  android: {
    package: "com.gsevents.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ea580c",
    },
    jsEngine: "hermes",
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  extra: {
    apiUrl: process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:4000/api/v1",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ea580c",
        image: "./assets/splash.png",
        resizeMode: "contain",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  locales: {
    en: "./locales/en.json",
    hi: "./locales/hi.json",
    gu: "./locales/gu.json",
  },
});
