import { createOptmizedSetting } from '@/service/ai/generator';
import {
  botaoStyles,
  cardStyles,
  inputStyles,
  layoutStyles,
  resolucaoStyles,
  textoStyles,
} from '@/styles';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const RESOLUCOES = [
  '1280x720 (HD)',
  '1920x1080 (Full HD)',
  '2560x1440 (2K)',
  '3840x2160 (4K)',
];

// ---------------------------------------------------------------------------
// Parser — mantido intacto; será substituído no Bloco 2 por dados estruturados
// ---------------------------------------------------------------------------
function parseResposta(text: string) {
  const linhas = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const configs: { nome: string; valor: string; justificativa: string }[] = [];
  let fps = '';

  for (const linha of linhas) {
    if (linha.toLowerCase().startsWith('fps estimado')) {
      fps = linha.replace(/^fps estimado:\s*/i, '').trim();
      continue;
    }
    const separador = linha.indexOf(':');
    if (separador === -1) continue;

    const nome = linha.slice(0, separador).trim();
    const resto = linha.slice(separador + 1).trim();
    const dashIdx = resto.indexOf('—');

    if (dashIdx !== -1) {
      configs.push({
        nome,
        valor: resto.slice(0, dashIdx).trim(),
        justificativa: resto.slice(dashIdx + 1).trim(),
      });
    } else {
      configs.push({ nome, valor: resto, justificativa: '' });
    }
  }

  return { configs, fps };
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export default function Index() {
  const [jogo, setJogo] = useState('');
  const [placaVideo, setPlacaVideo] = useState('');
  const [processador, setProcessador] = useState('');
  const [memoria, setMemoria] = useState('');
  const [resolucao, setResolucao] = useState(RESOLUCOES[1]);
  const [resposta, setResposta] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const gerarConfiguracoes = async () => {
    setResposta('');
    setIsLoading(true);
    const resultado = await createOptmizedSetting({
      jogo,
      placaVideo,
      processador,
      memoria,
      resolucao,
    });
    setResposta(resultado);
    setIsLoading(false);
  };

  const { configs, fps } = parseResposta(resposta);

  return (
    <ScrollView contentContainerStyle={layoutStyles.telaScroll}>
      <Text style={textoStyles.display}>SettingsCraft</Text>
      <Text style={textoStyles.subtitulo}>
        Configurações gráficas otimizadas para o seu hardware
      </Text>

      <Text style={textoStyles.label}>Jogo</Text>
      <TextInput
        value={jogo}
        placeholder="ex: Cyberpunk 2077"
        placeholderTextColor="#606080"
        onChangeText={setJogo}
        style={inputStyles.campo}
      />

      <Text style={textoStyles.label}>Placa de vídeo</Text>
      <TextInput
        value={placaVideo}
        placeholder="ex: RTX 3060"
        placeholderTextColor="#606080"
        onChangeText={setPlacaVideo}
        style={inputStyles.campo}
      />

      <Text style={textoStyles.label}>Processador</Text>
      <TextInput
        value={processador}
        placeholder="ex: Intel i7-12700K"
        placeholderTextColor="#606080"
        onChangeText={setProcessador}
        style={inputStyles.campo}
      />

      <Text style={textoStyles.label}>Memória RAM</Text>
      <TextInput
        value={memoria}
        placeholder="ex: 16GB DDR4"
        placeholderTextColor="#606080"
        onChangeText={setMemoria}
        style={inputStyles.campo}
      />

      <Text style={textoStyles.label}>Resolução alvo</Text>
      <View style={resolucaoStyles.container}>
        {RESOLUCOES.map((res) => (
          <TouchableOpacity
            key={res}
            style={[
              resolucaoStyles.botao,
              resolucao === res && resolucaoStyles.botaoAtivo,
            ]}
            onPress={() => setResolucao(res)}
          >
            <Text
              style={[
                resolucaoStyles.textoBotao,
                resolucao === res && resolucaoStyles.textoBotaoAtivo,
              ]}
            >
              {res}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          botaoStyles.primario,
          isLoading && botaoStyles.primarioDesabilitado,
        ]}
        onPress={gerarConfiguracoes}
        disabled={isLoading}
      >
        <Text style={botaoStyles.textoPrimario}>
          {isLoading ? 'Gerando...' : 'Gerar Configurações'}
        </Text>
      </TouchableOpacity>

      {!!resposta && (
        <MotiView
          style={cardStyles.container}
          from={{ opacity: 0, translateY: 60 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', stiffness: 100 }}
        >
          <Text style={textoStyles.tituloCard}>⚙️ Configurações — {jogo}</Text>

          {configs.length > 0 ? (
            configs.map((item, index) => (
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
                  <Text style={cardStyles.justificativa}>
                    {item.justificativa}
                  </Text>
                )}
              </MotiView>
            ))
          ) : (
            <Text style={textoStyles.corpoCard}>{resposta}</Text>
          )}

          {!!fps && (
            <View style={cardStyles.badgeFps}>
              <Text style={cardStyles.textoFps}>🎮 {fps}</Text>
            </View>
          )}
        </MotiView>
      )}
    </ScrollView>
  );
}
