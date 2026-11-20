import { writeFileSync } from "node:fs";

const e = process.env;

const env = {
  IMBB_API_KEY: e.IMBB_API_KEY || "",
  firebase: {
    apiKey: e.FIREBASE_API_KEY || "",
    authDomain: e.FIREBASE_AUTH_DOMAIN || "",
    databaseURL: e.FIREBASE_DATABASE_URL || "",
    projectId: e.FIREBASE_PROJECT_ID || "",
    storageBucket: e.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: e.FIREBASE_APP_ID || ""
  }
};

writeFileSync("env.js", "export const ENV = " + JSON.stringify(env, null, 2) + ";\n");