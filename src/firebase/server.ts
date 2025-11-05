import * as admin from 'firebase-admin';

// IMPORTANT: This file should only be imported in server-side code.

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let adminApp: admin.app.App;

export function initializeAdminApp() {
  if (admin.apps.length > 0) {
    adminApp = admin.app();
  } else {
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Cannot initialize Firebase Admin SDK.');
    }
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();

  return { adminApp, db, auth };
}
