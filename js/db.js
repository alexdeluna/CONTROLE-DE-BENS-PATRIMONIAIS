import {
  collection, getDocs, getDoc, getCountFromServer, query, where, writeBatch, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { db } from "./firebase.js";

export const COLLECTIONS = {
  bens: "bens", categorias: "categorias", responsaveis: "responsaveis",
  setores: "setores", locais: "locais", andares: "andares", unidades: "unidades",
  movimentacoes: "movimentacoes", baixas: "baixas", auditoria: "auditoria", usuarios: "usuarios"
};

export async function getCollectionRows(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

export async function getAssetCounts() {
  // Os documentos importados usam o campo Situacao (S maiúsculo).
  // Lemos os bens e normalizamos para também aceitar documentos legados com "situacao".
  const snap = await getDocs(collection(db, COLLECTIONS.bens));
  let active = 0;
  let retired = 0;
  for (const item of snap.docs) {
    const data = item.data();
    const status = String(data.Situacao ?? data.situacao ?? "").trim().toLocaleLowerCase("pt-BR");
    if (status === "ativo") active++;
    if (status === "baixado") retired++;
  }
  return { total: snap.size, active, retired };
}

export async function importInitialDataset(dataset, userUid) {
  const expectedCollections = [
    ["unidades", dataset.Unidades, "ID_Unidade"],
    ["andares", dataset.Andares, "ID_Andar"],
    ["locais", dataset.LocaisFisicos, "ID_Local"],
    ["categorias", dataset.Categorias, "ID_Categoria"],
    ["setores", dataset.Setores, "ID_Setor"],
    ["responsaveis", dataset.Responsaveis, "ID_Responsavel"],
    ["bens", dataset.Bens, "Tombamento"]
  ];

  // Esta primeira versão só importa para uma base patrimonial vazia.
  const current = await getCountFromServer(collection(db, COLLECTIONS.bens));
  if (current.data().count > 0) {
    throw new Error("A coleção de bens já contém registros. A importação inicial não sobrescreve nem mescla dados existentes.");
  }

  // writeBatch aceita no máximo 500 operações; gravamos lotes separados.
  for (const [collectionName, rows, keyField] of expectedCollections) {
    for (let offset = 0; offset < rows.length; offset += 400) {
      const batch = writeBatch(db);
      const slice = rows.slice(offset, offset + 400);
      for (const row of slice) {
        const key = String(row[keyField] ?? "").trim();
        if (!key) throw new Error(`Registro sem identificador na coleção ${collectionName}.`);
        const ref = doc(db, collectionName, key);
        batch.set(ref, {
          ...row,
          _schemaVersion: 1,
          criadoEm: serverTimestamp(),
          criadoPor: userUid
        });
      }
      await batch.commit();
    }
  }
  return true;
}

// Limpeza destrutiva dos cadastros principais da base de teste.
// Preserva usuários, movimentações, baixas e auditoria.
export async function deleteTestMasterData() {
  const allowed = ["bens", "categorias", "responsaveis", "setores", "locais", "andares", "unidades"];
  for (const name of allowed) {
    const snap = await getDocs(collection(db, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach(item => batch.delete(item.ref));
      await batch.commit();
    }
  }
}

export async function recordAssetTransfer({ asset, destinationSector, destinationResponsible, reason, notes, user }) {
  const batch = writeBatch(db);
  const assetRef = doc(db, "bens", String(asset.Tombamento));
  const movementRef = doc(collection(db, "movimentacoes"));
  const auditRef = doc(collection(db, "auditoria"));
  const now = serverTimestamp();
  batch.set(assetRef, {
    ID_Setor: destinationSector.ID_Setor,
    ID_Responsavel: destinationResponsible?.ID_Responsavel ?? asset.ID_Responsavel ?? "",
    atualizadoEm: now,
    atualizadoPor: user.uid
  }, { merge: true });
  batch.set(movementRef, {
    Tombamento: String(asset.Tombamento),
    Descricao_Bem: asset.Descricao_Bem ?? "",
    tipo: "TRANSFERENCIA",
    setorOrigemId: asset.ID_Setor ?? "",
    setorOrigemNome: asset._origemNome ?? "",
    setorDestinoId: destinationSector.ID_Setor,
    setorDestinoNome: destinationSector.Nome_Setor,
    responsavelAnteriorId: asset.ID_Responsavel ?? "",
    responsavelNovoId: destinationResponsible?.ID_Responsavel ?? asset.ID_Responsavel ?? "",
    motivo: reason,
    observacoes: notes ?? "",
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  batch.set(auditRef, {
    entidade: "bem",
    Tombamento: String(asset.Tombamento),
    operacao: "TRANSFERENCIA",
    resumo: `Transferência do setor ${asset._origemNome || asset.ID_Setor} para ${destinationSector.Nome_Setor}`,
    motivo: reason,
    observacoes: notes ?? "",
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  await batch.commit();
}

export async function recordAssetDisposal({ asset, reason, documentNumber, notes, user }) {
  const batch = writeBatch(db);
  const assetRef = doc(db, "bens", String(asset.Tombamento));
  const disposalRef = doc(collection(db, "baixas"));
  const auditRef = doc(collection(db, "auditoria"));
  const now = serverTimestamp();
  batch.set(assetRef, {
    Situacao: "Baixado",
    atualizadoEm: now,
    atualizadoPor: user.uid
  }, { merge: true });
  batch.set(disposalRef, {
    Tombamento: String(asset.Tombamento),
    Descricao_Bem: asset.Descricao_Bem ?? "",
    categoriaId: asset.ID_Categoria ?? "",
    setorId: asset.ID_Setor ?? "",
    responsavelId: asset.ID_Responsavel ?? "",
    situacaoAnterior: asset.Situacao ?? "Ativo",
    situacaoNova: "Baixado",
    motivo: reason,
    documentoAutorizacao: documentNumber ?? "",
    observacoes: notes ?? "",
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  batch.set(auditRef, {
    entidade: "bem",
    Tombamento: String(asset.Tombamento),
    operacao: "BAIXA_PATRIMONIAL",
    resumo: `Baixa patrimonial do bem ${asset.Tombamento}`,
    motivo: reason,
    documentoAutorizacao: documentNumber ?? "",
    observacoes: notes ?? "",
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  await batch.commit();
}

export async function saveReferenceRecord(collectionName, id, data, creating = false) {
  const ref = doc(db, collectionName, String(id));
  const payload = { ...data, atualizadoEm: serverTimestamp() };
  if (creating) payload.criadoEm = serverTimestamp();
  await (await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js")).setDoc(ref, payload, { merge: !creating });
}

export async function saveAssetRecord({ asset, originalTombamento, creating, user }) {
  const newId = String(asset.Tombamento).trim();
  if (!newId) throw new Error("Tombamento é obrigatório.");
  const existingRef = doc(db, "bens", newId);
  if (creating) {
    const existing = await getDoc(existingRef);
    if (existing.exists()) throw new Error("Já existe um bem com esse tombamento.");
  } else if (String(originalTombamento) !== newId) {
    throw new Error("O tombamento não pode ser alterado durante a edição.");
  }
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, "auditoria"));
  const now = serverTimestamp();
  const payload = {
    ...asset,
    criadoEm: creating ? now : (asset.criadoEm ?? now),
    atualizadoEm: now,
    atualizadoPor: user.uid
  };
  batch.set(existingRef, payload, { merge: !creating });
  batch.set(auditRef, {
    entidade: "bem",
    Tombamento: newId,
    operacao: creating ? "CADASTRO_BEM" : "EDICAO_BEM",
    resumo: creating ? `Cadastro do bem ${newId}` : `Edição cadastral do bem ${newId}`,
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  await batch.commit();
}

export async function changeSectorLocation({ sector, destinationPlace, reason, notes, user, affectedAssetCount, affectedAssets = [] }) {
  const batch = writeBatch(db);
  const sectorRef = doc(db, "setores", String(sector.ID_Setor));
  const movementRef = doc(collection(db, "movimentacoes"));
  const auditRef = doc(collection(db, "auditoria"));
  const now = serverTimestamp();
  batch.set(sectorRef, {
    ID_Local_Atual: destinationPlace.ID_Local,
    atualizadoEm: now,
    atualizadoPor: user.uid
  }, { merge: true });
  batch.set(movementRef, {
    tipo: "MUDANCA_LOCALIZACAO_SETOR",
    setorId: String(sector.ID_Setor),
    setorNome: sector.Nome_Setor ?? "",
    localOrigemId: sector.ID_Local_Atual ?? sector.ID_Local_Referencia ?? "",
    localOrigemNome: sector._origemDescricao ?? "",
    localDestinoId: String(destinationPlace.ID_Local),
    localDestinoNome: destinationPlace._descricaoCompleta ?? destinationPlace.Descricao_Local ?? destinationPlace.Nome_Local_Fisico ?? "",
    motivo: reason,
    observacoes: notes ?? "",
    quantidadeBensAfetados: affectedAssetCount,
    // Snapshot dos tombamentos vinculados ao setor no instante da mudança.
    // A ficha do bem usa essa lista para exibir o evento indireto sem duplicar o registro.
    bensAfetados: affectedAssets.map(item => String(item.Tombamento ?? "")).filter(Boolean),
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  batch.set(auditRef, {
    entidade: "setor",
    setorId: String(sector.ID_Setor),
    operacao: "MUDANCA_LOCALIZACAO_SETOR",
    resumo: `Mudança de localização do setor ${sector.Nome_Setor}`,
    localOrigemId: sector.ID_Local_Atual ?? sector.ID_Local_Referencia ?? "",
    localOrigemNome: sector._origemDescricao ?? "",
    localDestinoId: String(destinationPlace.ID_Local),
    localDestinoNome: destinationPlace.Descricao_Local ?? destinationPlace.Nome_Local_Fisico ?? "",
    motivo: reason,
    observacoes: notes ?? "",
    quantidadeBensAfetados: affectedAssetCount,
    criadoEm: now,
    criadoPor: user.uid,
    usuarioEmail: user.email ?? ""
  });
  await batch.commit();
}
