import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getDoc(doc(db, "usuarios", credential.user.uid));
  if (!profile.exists() || profile.data().ativo !== true || !["ADM", "GESTOR_PATRIMONIAL"].includes(profile.data().perfil)) {
    await signOut(auth);
    throw new Error("Usuário sem perfil autorizado. Solicite ao administrador a configuração do seu acesso.");
  }
  return { user: credential.user, profile: profile.data() };
}

export async function logout() {
  return signOut(auth);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getAuthorizedProfile(user) {
  if (!user) return null;
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists()) return null;
  const profile = snap.data();
  if (profile.ativo !== true || !["ADM", "GESTOR_PATRIMONIAL"].includes(profile.perfil)) return null;
  return profile;
}
