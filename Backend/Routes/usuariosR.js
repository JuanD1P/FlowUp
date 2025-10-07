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

//obtener equipo del usuario
userRouter.get("/usuarios/:id/equipo", async (req, res) => {
  try {
    const { id } = req.params;
    const snap = await firestoreAdmin.collection("usuarios").doc(id).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const data = snap.data();
    res.json({ equipo: data.equipo });
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener el equipo del usuario" });
  }
});

//obtener todos los equipos
userRouter.get("/equipos", async (req, res) => {
  try {
    const snap = await firestoreAdmin.collection("equipos").get();  
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener los equipos" });
  }
});

//eliminar equipo
// eliminar equipo
userRouter.delete("/equipos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const teamRef = firestoreAdmin.collection("equipos").doc(id);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return res.status(404).json({ error: "El equipo no existe" });
    }

    // 1) Borrar subcolección 'nadadores' (si no usas recursiveDelete)
    const nadadoresSnap = await teamRef.collection("nadadores").get();
    if (!nadadoresSnap.empty) {
      const BATCH = 450;
      for (let i = 0; i < nadadoresSnap.docs.length; i += BATCH) {
        const batch = firestoreAdmin.batch();
        nadadoresSnap.docs.slice(i, i + BATCH).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // 2) (Opcional pero recomendado) limpiar usuarios que apunten a este equipo
    const usersSnap = await firestoreAdmin
      .collection("usuarios")
      .where("equipo", "==", id)
      .get();

    if (!usersSnap.empty) {
      const BATCH = 450;
      for (let i = 0; i < usersSnap.docs.length; i += BATCH) {
        const batch = firestoreAdmin.batch();
        usersSnap.docs.slice(i, i + BATCH).forEach((uDoc) => {
          // quita la referencia; usa delete para remover el campo
          batch.update(uDoc.ref, { equipo: admin.firestore.FieldValue.delete?.() ?? null });
        });
        await batch.commit();
      }
    }

    // 3) Borrar el documento del equipo
    await teamRef.delete();

    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /equipos error:", e);
    return res.status(500).json({ error: "No se pudo eliminar el equipo" });
  }
});
