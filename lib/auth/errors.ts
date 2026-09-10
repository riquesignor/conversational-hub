/**
 * Traduz os códigos de erro do Firebase Auth (sempre no formato
 * "auth/algo-assim") pra uma frase em português — o SDK só devolve o
 * código e uma mensagem em inglês, nenhuma das duas apresentável direto
 * pro usuário final.
 */
export function translateAuthError(err: unknown): string {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Já existe uma conta com esse e-mail. Tenta entrar em vez de criar conta.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/weak-password":
      return "Senha fraca — use pelo menos 6 caracteres.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Aguarda um pouco e tenta de novo.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Login cancelado.";
    case "auth/network-request-failed":
      return "Falha de conexão. Verifica sua internet e tenta de novo.";
    default:
      return "Não deu pra completar o login. Tenta de novo em instantes.";
  }
}
