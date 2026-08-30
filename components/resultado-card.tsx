import type { Resultado } from '@/service/ai/schema';
import { botaoStyles, cardStyles, Cores, layoutStyles, textoStyles } from '@/styles';
import { MotiView } from 'moti';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

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
}

export function ResultadoCard({
  jogo,
  resolucaoConsultada,
  resultado,
  aoGerarNovamente,
  gerandoNovamente,
  desabilitado,
}: ResultadoCardProps) {
  return (
    <MotiView
      style={cardStyles.container}
      from={{ opacity: 0, translateY: 60 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      <Text style={textoStyles.tituloCard}>⚙️ Configurações — {jogo}</Text>

      {resultado.configuracoes.map((item, index) => (
        <MotiView
          key={index}
          style={cardStyles.linhaConfig}
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 300, delay: index * 60 }}
        >
          <View style={layoutStyles.rowSpaceBetween}>
            <Text style={cardStyles.nomeConfig}>{item.nome}</Text>
            <View style={cardStyles.badgeValor}>
              <Text style={cardStyles.textoValor}>{item.valor}</Text>
            </View>
          </View>
          {!!item.justificativa && (
            <Text style={cardStyles.justificativa}>{item.justificativa}</Text>
          )}
        </MotiView>
      ))}

      {!!resultado.fpsEstimado && (
        <View style={cardStyles.badgeFps}>
          <Text style={cardStyles.rotuloFps}>
            FPS estimado em {resolucaoConsultada}
          </Text>
          <Text selectable style={cardStyles.textoFps}>{resultado.fpsEstimado}</Text>
        </View>
      )}

      <View style={cardStyles.seloOrigem}>
        <Text style={cardStyles.textoOrigem}>
          Origem: {resultado.fonte} · Gerado em {formatarDataGeracao(resultado.geradoEm)}
        </Text>
      </View>

      {!!aoGerarNovamente && (
        <TouchableOpacity
          style={[
            botaoStyles.secundario,
            desabilitado && botaoStyles.secundarioDesabilitado,
          ]}
          onPress={aoGerarNovamente}
          disabled={desabilitado}
        >
          {gerandoNovamente ? (
            <View style={layoutStyles.row}>
              <ActivityIndicator color={Cores.acento} />
              <Text style={botaoStyles.textoSecundario}>Gerando novamente...</Text>
            </View>
          ) : (
            <Text style={botaoStyles.textoSecundario}>Gerar novamente</Text>
          )}
        </TouchableOpacity>
      )}
    </MotiView>
  );
}
