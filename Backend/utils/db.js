//CONEXION A LA BD DE FIREBASE
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const keyPath = path.join(__dirname, "../serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, "utf8");
    return JSON.parse(raw);
  }
  throw new Error("No se encontró Service Account (ENV o archivo).");
}

const serviceAccount = loadServiceAccount();
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
