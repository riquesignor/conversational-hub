import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/use-auth";

export const metadata: Metadata = {
  title: "Chatbot Portfolio",
  description: "Chatbot com streaming construído com Next.js e Vercel AI SDK",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        {/* Link direto (não next/font/google) de propósito: next/font busca o
            arquivo da fonte durante o build, o que falha em ambientes de CI/
            sandbox sem saída de rede liberada para fonts.googleapis.com. Um
            <link> é só uma tag estática — o navegador do visitante busca a
            fonte em runtime, sem risco nenhum pro build. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&family=Manrope:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* AuthProvider é client-only (ver lib/auth/use-auth.tsx) mas pode
            envolver a árvore inteira aqui mesmo num layout de servidor —
            só o que está DENTRO dele roda no cliente, não o layout todo. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
