import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { userRouter } from './Routes/usuariosR.js';
import 'dotenv/config';

import { authAdmin, firestoreAdmin } from './utils/db.js';
import { requireAuth } from './middlewares/requireAuth.js';

const app = express();

// CORS
app.use(cors({
  origin: ["http://localhost:5173"], // tu front
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.post('/auth/session', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Falta idToken" });

    const decoded = await authAdmin.verifyIdToken(idToken);
    const uid = decoded.uid;

    const doc = await firestoreAdmin.collection("usuarios").doc(uid).get();
    const rol = doc.exists ? (doc.data().rol || "USER") : "USER";

    res.json({ ok: true, uid, rol });
  } catch (e) {
    console.error("❌ Error en /auth/session:", e?.message);
    res.status(401).json({ error: "Token inválido" });
  }
});

app.use('/api', requireAuth, userRouter);

app.listen(3000, () => {
  console.log("🚀 Servidor en funcionamiento en http://localhost:3000");
});
