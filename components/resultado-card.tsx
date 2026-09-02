import { Botao } from '@/components/botao';
import type { Resultado } from '@/service/ai/schema';
import { cardStyles, layoutStyles, textoStyles } from '@/styles';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
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
        <Text style={cardStyles.textoOrigem}>
          {resultado.fonte} · {formatarDataGeracao(resultado.geradoEm)}
        </Text>
      </View>

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
