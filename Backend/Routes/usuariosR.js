import { Router } from "express";
import { firestoreAdmin, authAdmin } from "../utils/db.js";

export const userRouter = Router();

// OBTENER TODOS LOS USUARIO
userRouter.get("/usuarios", async (_req, res) => {
  try {
    const snap = await firestoreAdmin.collection("usuarios").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener usuarios" });
  }
});

// ACTUALIZAR ROL DE USUARIOS
userRouter.put("/usuarios/:id/rol", async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body || {};
    if (!rol || !["USER", "ADMIN"].includes(rol)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    await firestoreAdmin.collection("usuarios").doc(id).set({ rol }, { merge: true });
    await authAdmin.setCustomUserClaims(id, { role: rol });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo actualizar el rol" });
  }
});

// BORRAR USUARIOS
userRouter.delete("/usuarios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await firestoreAdmin.collection("usuarios").doc(id).delete();
    await authAdmin.deleteUser(id);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el usuario" });
  }
});
