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
    if (!rol || !["USER", "ADMIN", "USEREN"].includes(rol)) {
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

//Obtiene la lista de nadadores
userRouter.get("/nadadores", async (req, res) => {
  try {
    const snap = await firestoreAdmin.collection("usuarios").where("rol", "==", "USER").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener nadadores" });
  }
});

// Obtiene los miembros del equipo
userRouter.get("/equipos/:Id/miembros", async (req, res) => {
  try {
    const { Id } = req.params;
    const snap = await firestoreAdmin.collection("usuarios").where("equipo", "==", Id).get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener los miembros del equipo" });
  }
});
