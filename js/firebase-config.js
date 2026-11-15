import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onDisconnect,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDejlLtvFPTFOJoXMFGjpuhImn6oYFCAxM",
  authDomain: "darshang-8f99d.firebaseapp.com",
  databaseURL: "https://darshang-8f99d-default-rtdb.firebaseio.com",
  projectId: "darshang-8f99d",
  storageBucket: "darshang-8f99d.firebasestorage.app",
  messagingSenderId: "199221437404",
  appId: "1:199221437404:web:e9c42331f2879378f6e519"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onDisconnect,
  serverTimestamp,
  increment
};