// Backend/index.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { userRouter } from './Routes/usuariosR.js';
import 'dotenv/config';

import { authAdmin, firestoreAdmin } from './utils/db.js';
import { requireAuth } from './middlewares/requireAuth.js';

const app = express();

app.use(cors({
  origin: ["http://localhost:5173"],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// (opcional pero útil) healthcheck
app.get('/api/health', (_, res) => res.json({ ok: true }));

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

// 👇 Exporta para que Vercel lo ejecute como serverless
export default app;

// 👇 Solo escucha en local
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Local en http://localhost:${PORT}`));
}
