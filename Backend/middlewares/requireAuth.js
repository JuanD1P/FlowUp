import { authAdmin } from "../utils/db.js";

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Falta token (Bearer)" });

    const decoded = await authAdmin.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    console.error("Auth error:", e?.message);
    res.status(401).json({ error: "No autorizado" });
  }
};
