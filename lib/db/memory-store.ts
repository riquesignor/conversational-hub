// Este arquivo não é mais usado. lib/db/index.ts não importa mais
// MemoryConversationStore — Firestore virou o único backend de persistência
// desde que login passou a ser obrigatório (ver middleware.ts): o login já
// exige Firebase Admin configurado, então não fazia mais sentido manter um
// branch "funciona sem configurar nada" que ninguém alcança de qualquer
// forma. Ver README, seção "Autenticação e Firestore".
//
// Pode apagar este arquivo com segurança:
//
//   rm lib/db/memory-store.ts
//
// (Não apaguei automaticamente porque o bridge deste projeto, nesta sessão,
// só consegue escrever/sobrescrever arquivo no seu pendrive, não apagar.)
export {};
