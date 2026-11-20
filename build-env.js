import { writeFileSync } from "node:fs";

const e = process.env;

const pick = (...keys) => {
  for (const k of keys) {
    if (e[k]) return e[k];
  }
  return "";
};

const env = {
  IMBB_API_KEY: e.IMBB_API_KEY || "",
  firebase: {
    apiKey: pick("FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"),
    authDomain: pick("FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"),
    databaseURL: pick("FIREBASE_DATABASE_URL", "NEXT_PUBLIC_FIREBASE_DATABASE_URL", "VITE_FIREBASE_DATABASE_URL"),
    projectId: pick("FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: pick("FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: pick("FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: pick("FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID")
  }
};

if (!env.firebase.apiKey || !env.firebase.databaseURL) {
  console.error("Missing Firebase environment variables (FIREBASE_API_KEY / FIREBASE_DATABASE_URL). Add them in Vercel > Settings > Environment Variables.");
  process.exit(1);
}

writeFileSync("env.js", "export const ENV = " + JSON.stringify(env, null, 2) + ";\n");