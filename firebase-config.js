/* ============================================================
   FIREBASE CONFIG — replace the placeholder values below with
   YOUR OWN project's config.

   How to get them (free, ~2 minutes):
   1) Go to https://console.firebase.google.com
   2) "Add project" → give it any name → you can skip Google
      Analytics if it asks.
   3) Once inside the project, click the "</>" (web) icon to
      register a web app → give it any nickname → "Register app".
   4) Firebase will show you a `firebaseConfig` object — copy its
      values into the object below.
   5) In the left sidebar go to "Build" → "Firestore Database" →
      "Create database" → choose a region close to Egypt →
      start in "test mode" for now.
   6) In Firestore → "Rules" tab, paste the rules below and
      click "Publish":

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /{document=**} {
              allow read: if true;
              allow write: if true;
            }
          }
        }

      NOTE: these rules let anyone with the site's code write to
      the database directly (not just through the admin login on
      the site — that login is just a UI gate, not real security).
      That's fine for getting started, but if this becomes a real
      public product later, we should add proper Firebase
      Authentication so only your team can write. Ask me and I'll
      set that up when you're ready.
   ============================================================ */

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
