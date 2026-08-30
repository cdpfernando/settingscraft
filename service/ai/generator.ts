const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
const defaultErrorMessage = "Não foi possível gerar as configurações. Tente novamente.";

if (!apiKey) {
  console.warn("[createOptmizedSetting] EXPO_PUBLIC_GEMINI_API_KEY não está definido.");
}

export interface HardwareInfo {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: string;
  resolucao: string;
}

export async function createOptmizedSetting(info: HardwareInfo) {
  if (!apiKey) {
    console.error("[createOptmizedSetting] EXPO_PUBLIC_GEMINI_API_KEY não está configurada.");
    return defaultErrorMessage;
  }

  const prompt = `
Jogo: ${info.jogo}
Placa de vídeo: ${info.placaVideo}
Processador: ${info.processador}
Memória RAM: ${info.memoria}
Resolução desejada: ${info.resolucao}

Liste as configurações gráficas do jogo "${info.jogo}" na ordem exata em que aparecem no menu gráfico do jogo, recomendando os valores ideais para este hardware rodar em ${info.resolucao}. Siga rigorosamente o formato definido.
  `.trim();

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "Você é um especialista em benchmark e otimização de jogos para PC. Sempre responda EXCLUSIVAMENTE no formato abaixo, sem introduções, sem explicações extras, sem markdown e sem texto fora do padrão. Liste APENAS as configurações na ordem exata em que aparecem no menu gráfico do jogo informado. Para cada configuração use exatamente este formato (uma por linha):\n[Nome da configuração]: [Valor recomendado] — [Justificativa em até 10 palavras]\nAo final, adicione uma linha em branco seguida de: FPS estimado: [valor ou faixa] a [resolução]. Não adicione nenhum outro texto." }],
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error("[createOptmizedSetting] Erro na API:", response.status, errorBody);

      if (response.status === 429) {
        return "Limite de requisições atingido. Tente novamente em alguns segundos.";
      }
      throw new Error(`HTTP ${response.status}: ${errorBody?.error?.message ?? "Erro desconhecido"}`);
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || defaultErrorMessage;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`[createOptmizedSetting] Falha ao gerar configurações: ${error.message}`, { info });
    return defaultErrorMessage;
  }
}
