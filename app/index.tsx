import {
  OPCOES_MEMORIA,
  PLACAS_VIDEO,
  PROCESSADORES,
  RESOLUCOES,
} from '@/assets/data/hardware';
import { AutocompleteHardware } from '@/components/autocomplete-hardware';
import { ResultadoCard } from '@/components/resultado-card';
import { SeletorOpcoes } from '@/components/seletor-opcoes';
import { createOptmizedSetting } from '@/service/ai/generator';
import type { Resultado } from '@/service/ai/schema';
import {
  alertaStyles,
  botaoStyles,
  Cores,
  inputStyles,
  layoutStyles,
  textoStyles,
} from '@/styles';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const CAMPOS_OBRIGATORIOS = ['jogo', 'placaVideo', 'processador', 'memoria'] as const;
type CampoObrigatorio = (typeof CAMPOS_OBRIGATORIOS)[number];
type Erros = Partial<Record<CampoObrigatorio, string>>;

export default function Index() {
  const router = useRouter();
  const [jogo, setJogo] = useState('');
  const [placaVideo, setPlacaVideo] = useState('');
  const [processador, setProcessador] = useState('');
  const [memoria, setMemoria] = useState('');
  const [resolucao, setResolucao] = useState<string>(RESOLUCOES[1]);
  const [erros, setErros] = useState<Erros>({});
  const [erroApi, setErroApi] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [resolucaoConsultada, setResolucaoConsultada] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGerandoNovamente, setIsGerandoNovamente] = useState(false);

  const desabilitado = isLoading || isGerandoNovamente;

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
    if (desabilitado) return;
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
      setResolucaoConsultada(resolucao);
    } else {
      setErroApi(resposta.erro);
    }
    setIsLoading(false);
  };

  const gerarNovamente = async () => {
    if (desabilitado) return;
    if (!validarFormulario()) return;

    Keyboard.dismiss();
    setErroApi('');
    setIsGerandoNovamente(true);

    const resposta = await createOptmizedSetting(
      {
        jogo,
        placaVideo,
        processador,
        memoria,
        resolucao,
      },
      { ignorarCache: true },
    );

    if (resposta.ok) {
      setResultado(resposta.resultado);
      setResolucaoConsultada(resolucao);
    } else {
      setErroApi(resposta.erro);
    }
    setIsGerandoNovamente(false);
  };

  return (
    <ScrollView
      contentContainerStyle={layoutStyles.telaScroll}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/historico')}
              accessibilityRole="button"
              accessibilityLabel="Ver histórico de consultas"
              hitSlop={8}
            >
              <Text style={textoStyles.linkHeader}>Histórico</Text>
            </Pressable>
          ),
        }}
      />
      <Text style={textoStyles.display}>SettingsCraft</Text>
      <Text style={textoStyles.subtitulo}>
        O menu gráfico no tamanho do seu PC
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
          desabilitado && botaoStyles.primarioDesabilitado,
        ]}
        onPress={gerarConfiguracoes}
        disabled={desabilitado}
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
        <ResultadoCard
          jogo={jogo}
          resolucaoConsultada={resolucaoConsultada}
          resultado={resultado}
          aoGerarNovamente={gerarNovamente}
          gerandoNovamente={isGerandoNovamente}
          desabilitado={desabilitado}
        />
      )}
    </ScrollView>
  );
}
