import { Botao } from '@/components/botao';
import { formatarConfiancaFps, formatarPresetFpsHq } from '@/service/ai/formatacao';
import type { FonteEntrega, GeradoPor, Resultado } from '@/service/ai/schema';
import { cardStyles, layoutStyles, textoStyles } from '@/styles';
import * as Linking from 'expo-linking';
import { MotiView } from 'moti';
import { Pressable, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function formatarDataGeracao(valor: string): string {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return 'data indisponível';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(data);
}

function formatarGerador(valor: GeradoPor): string {
  const rotulos: Record<GeradoPor, string> = {
    gemini: 'Gemini',
    groq: 'Groq',
    exemplo: 'Exemplo',
  };

  return rotulos[valor];
}

function formatarFonteEntrega(valor: FonteEntrega): string {
  const rotulos: Record<FonteEntrega, string> = {
    salvo: 'cache local',
    compartilhado: 'cache compartilhado',
    gemini: 'Gemini',
    groq: 'Groq',
    exemplo: 'resultado de exemplo',
  };

  return rotulos[valor];
}

interface ResultadoCardProps {
  jogo: string;
  resolucaoConsultada: string;
  resultado: Resultado;
  aoGerarNovamente?: () => void;
  gerandoNovamente?: boolean;
  desabilitado?: boolean;
  embutido?: boolean;
}

export function ResultadoCard({
  jogo,
  resolucaoConsultada,
  resultado,
  aoGerarNovamente,
  gerandoNovamente,
  desabilitado,
  embutido,
}: ResultadoCardProps) {
  const movimentoReduzido = useReducedMotion();
  const evidencia = resultado.evidenciaDesempenho;
  const descricaoEvidencia = evidencia?.tipo === 'benchmark'
    ? 'benchmark do FPSHQ'
    : 'projeção do FPSHQ';

  const abrirAtribuicao = () => {
    if (!evidencia) return;
    void Linking.openURL(evidencia.urlAtribuicao).catch((erro) => {
      console.error('[ResultadoCard] Não foi possível abrir a atribuição do FPSHQ:', erro);
    });
  };

  return (
    <MotiView
      style={[cardStyles.container, embutido && cardStyles.containerEmbutido]}
      from={movimentoReduzido ? undefined : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: movimentoReduzido ? 0 : 200 }}
    >
      <Text style={textoStyles.tituloCard}>{jogo}</Text>
      <Text style={textoStyles.metaCard}>{resolucaoConsultada}</Text>

      {resultado.configuracoes.map((item, index) => (
        <MotiView
          key={`${item.nome}-${index}`}
          style={cardStyles.linhaConfig}
          from={movimentoReduzido ? undefined : { opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'timing',
            duration: movimentoReduzido ? 0 : 200,
            delay: movimentoReduzido ? 0 : Math.min(index, 6) * 100,
          }}
        >
          <View style={layoutStyles.rowSpaceBetween}>
            <Text style={cardStyles.nomeConfig}>{item.nome}</Text>
            <Text selectable style={cardStyles.textoValor}>
              {item.valor}
            </Text>
          </View>
          {!!item.justificativa && (
            <Text style={cardStyles.justificativa}>{item.justificativa}</Text>
          )}
        </MotiView>
      ))}

      {!!resultado.fpsEstimado && (
        <View style={cardStyles.linhaConfig}>
          <View style={layoutStyles.rowSpaceBetween}>
            <Text style={cardStyles.nomeConfig}>
              FPS estimado em {resolucaoConsultada}
            </Text>
            <Text selectable style={cardStyles.textoFps}>
              {resultado.fpsEstimado}
            </Text>
          </View>
        </View>
      )}

      <View style={cardStyles.seloOrigem}>
        <Text selectable style={cardStyles.textoOrigem}>
          Obtido de {formatarFonteEntrega(resultado.fonte)}
        </Text>
        <Text selectable style={cardStyles.textoOrigem}>
          Gerado por {formatarGerador(resultado.geradoPor)} · {formatarDataGeracao(resultado.geradoEm)}
        </Text>
      </View>

      {!!evidencia && (
        <View style={cardStyles.evidencia}>
          <Text selectable style={cardStyles.textoEvidencia}>
            FPS apoiado por {descricaoEvidencia} · confiança {formatarConfiancaFps(resultado.confiancaFps)}
          </Text>
          {evidencia.correspondencia === 'parcial' && (
            <Text selectable style={cardStyles.detalheEvidencia}>
              Correspondência parcial: processador não localizado no FPSHQ.
            </Text>
          )}
          <Text selectable style={cardStyles.detalheEvidencia}>
            Referência externa, não configuração final: {formatarPresetFpsHq(evidencia.presetReferencia)}
            {' '}em {evidencia.resolucao} · média {evidencia.fpsMedio}, mínimo {evidencia.fpsMinimo},
            {' '}máximo {evidencia.fpsMaximo} FPS
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Abrir dados de FPS no FPSHQ"
            accessibilityHint="Abre a página de atribuição no navegador"
            onPress={abrirAtribuicao}
            style={({ pressed }) => [
              cardStyles.linkAtribuicao,
              pressed && cardStyles.linkAtribuicaoPressionado,
            ]}
          >
            <Text style={cardStyles.textoLinkAtribuicao}>Dados de FPS: FPSHQ</Text>
          </Pressable>
        </View>
      )}

      {!evidencia && (
        <Text selectable style={cardStyles.textoSemEvidencia}>
          FPS estimado somente pela IA · confiança baixa
        </Text>
      )}

      {!!aoGerarNovamente && (
        <Botao
          titulo="Gerar novamente"
          tituloCarregando="Gerando novamente"
          variante="secundario"
          carregando={gerandoNovamente}
          desabilitado={desabilitado}
          onPress={aoGerarNovamente}
        />
      )}
    </MotiView>
  );
}
