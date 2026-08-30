import {
  OPCOES_MEMORIA,
  PLACAS_VIDEO,
  PROCESSADORES,
  RESOLUCOES,
} from '@/assets/data/hardware';
import { AutocompleteHardware } from '@/components/autocomplete-hardware';
import { SeletorOpcoes } from '@/components/seletor-opcoes';
import { createOptmizedSetting } from '@/service/ai/generator';
import type { Resultado } from '@/service/ai/schema';
import {
  alertaStyles,
  botaoStyles,
  cardStyles,
  Cores,
  inputStyles,
  layoutStyles,
  textoStyles,
} from '@/styles';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const CAMPOS_OBRIGATORIOS = ['jogo', 'placaVideo', 'processador', 'memoria'] as const;
type CampoObrigatorio = (typeof CAMPOS_OBRIGATORIOS)[number];
type Erros = Partial<Record<CampoObrigatorio, string>>;

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export default function Index() {
  const [jogo, setJogo] = useState('');
  const [placaVideo, setPlacaVideo] = useState('');
  const [processador, setProcessador] = useState('');
  const [memoria, setMemoria] = useState('');
  const [resolucao, setResolucao] = useState<string>(RESOLUCOES[1]);
  const [erros, setErros] = useState<Erros>({});
  const [erroApi, setErroApi] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const valores: Record<CampoObrigatorio, string> = { jogo, placaVideo, processador, memoria };

  const editarCampo = (campo: CampoObrigatorio, valor: string) => {
    if (campo === 'jogo') setJogo(valor);
    else if (campo === 'placaVideo') setPlacaVideo(valor);
    else if (campo === 'processador') setProcessador(valor);
    else setMemoria(valor);

    if (erros[campo]) {
      setErros((atual) => ({ ...atual, [campo]: undefined }));
    }
  };

  const validarFormulario = () => {
    const novosErros: Erros = {};
    for (const campo of CAMPOS_OBRIGATORIOS) {
      if (!valores[campo].trim()) {
        novosErros[campo] = 'Campo obrigatório';
      }
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const gerarConfiguracoes = async () => {
    if (isLoading) return;
    if (!validarFormulario()) return;

    Keyboard.dismiss();
    setResultado(null);
    setErroApi('');
    setIsLoading(true);

    const resposta = await createOptmizedSetting({
      jogo,
      placaVideo,
      processador,
      memoria,
      resolucao,
    });

    if (resposta.ok) {
      setResultado(resposta.resultado);
    } else {
      setErroApi(resposta.erro);
    }
    setIsLoading(false);
  };

  return (
    <ScrollView
      contentContainerStyle={layoutStyles.telaScroll}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={textoStyles.display}>SettingsCraft</Text>
      <Text style={textoStyles.subtitulo}>
        Configurações gráficas otimizadas para o seu hardware
      </Text>

      <Text style={textoStyles.label}>Jogo</Text>
      <View style={inputStyles.container}>
        <TextInput
          value={jogo}
          placeholder="ex: Cyberpunk 2077"
          placeholderTextColor={Cores.textoTerciario}
          onChangeText={(v) => editarCampo('jogo', v)}
          style={[inputStyles.campo, erros.jogo && inputStyles.campoErro]}
        />
        {!!erros.jogo && <Text style={inputStyles.mensagemErro}>{erros.jogo}</Text>}
      </View>

      <AutocompleteHardware
        label="Placa de vídeo"
        value={placaVideo}
        opcoes={PLACAS_VIDEO}
        placeholder="ex: RTX 3060"
        erro={erros.placaVideo}
        onChangeText={(valor) => editarCampo('placaVideo', valor)}
      />

      <AutocompleteHardware
        label="Processador"
        value={processador}
        opcoes={PROCESSADORES}
        placeholder="ex: Intel Core i7-12700K"
        erro={erros.processador}
        onChangeText={(valor) => editarCampo('processador', valor)}
      />

      <SeletorOpcoes
        label="Memória RAM"
        opcoes={OPCOES_MEMORIA}
        valor={memoria}
        erro={erros.memoria}
        onChange={(valor) => editarCampo('memoria', valor)}
      />

      <SeletorOpcoes
        label="Resolução alvo"
        opcoes={RESOLUCOES}
        valor={resolucao}
        onChange={setResolucao}
      />

      <TouchableOpacity
        style={[
          botaoStyles.primario,
          isLoading && botaoStyles.primarioDesabilitado,
        ]}
        onPress={gerarConfiguracoes}
        disabled={isLoading}
      >
        {isLoading ? (
          <View style={layoutStyles.row}>
            <ActivityIndicator color={Cores.textoInverso} />
            <Text style={botaoStyles.textoPrimario}>Gerando...</Text>
          </View>
        ) : (
          <Text style={botaoStyles.textoPrimario}>Gerar Configurações</Text>
        )}
      </TouchableOpacity>

      {!!erroApi && (
        <View style={alertaStyles.erro}>
          <Text style={alertaStyles.textoErro}>{erroApi}</Text>
        </View>
      )}

      {!!resultado && (
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
              <Text style={cardStyles.textoFps}>🎮 {resultado.fpsEstimado}</Text>
            </View>
          )}
        </MotiView>
      )}
    </ScrollView>
  );
}
