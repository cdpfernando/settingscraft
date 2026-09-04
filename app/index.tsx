import {
  OPCOES_MEMORIA,
  PLACAS_VIDEO,
  PROCESSADORES,
  RESOLUCOES,
} from '@/assets/data/hardware';
import { AutocompleteHardware } from '@/components/autocomplete-hardware';
import { Botao } from '@/components/botao';
import { LembrarHardware } from '@/components/lembrar-hardware';
import { ResultadoCard } from '@/components/resultado-card';
import { SeletorOpcoes } from '@/components/seletor-opcoes';
import { createOptmizedSetting } from '@/service/ai/generator';
import type { Resultado } from '@/service/ai/schema';
import {
  criarRepositorioHardwareLembrado,
  type HardwareLembrado,
} from '@/service/hardware-lembrado';
import {
  alertaStyles,
  Cores,
  headerStyles,
  inputStyles,
  layoutStyles,
  textoStyles,
} from '@/styles';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

const CAMPOS_OBRIGATORIOS = ['jogo', 'placaVideo', 'processador', 'memoria'] as const;
type CampoObrigatorio = (typeof CAMPOS_OBRIGATORIOS)[number];
type Erros = Partial<Record<CampoObrigatorio, string>>;

const repositorioHardware = criarRepositorioHardwareLembrado();

export default function Index() {
  const router = useRouter();
  const [jogo, setJogo] = useState('');
  const [placaVideo, setPlacaVideo] = useState('');
  const [processador, setProcessador] = useState('');
  const [memoria, setMemoria] = useState('');
  const [resolucao, setResolucao] = useState<string>(RESOLUCOES[1]);
  const [lembrarHardware, setLembrarHardware] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [erroApi, setErroApi] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [resolucaoConsultada, setResolucaoConsultada] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGerandoNovamente, setIsGerandoNovamente] = useState(false);
  const lembrarHardwareRef = useRef(false);

  const desabilitado = isLoading || isGerandoNovamente;

  const valores: Record<CampoObrigatorio, string> = { jogo, placaVideo, processador, memoria };

  const definirLembrarHardware = (ligado: boolean) => {
    lembrarHardwareRef.current = ligado;
    setLembrarHardware(ligado);
  };

  const aplicarHardware = (perfil: HardwareLembrado) => {
    setPlacaVideo(perfil.placaVideo);
    setProcessador(perfil.processador);
    setMemoria(perfil.memoria);
    setResolucao(perfil.resolucao);
    setErros((atual) => ({
      ...atual,
      placaVideo: undefined,
      processador: undefined,
      memoria: undefined,
    }));
  };

  useEffect(() => {
    let ativo = true;

    repositorioHardware
      .ler()
      .then((perfil) => {
        if (!ativo || !perfil) return;
        aplicarHardware(perfil);
        definirLembrarHardware(true);
      })
      .catch((erro) => {
        console.error('[consulta] Não foi possível ler o hardware lembrado:', erro);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const aoAlternarLembrar = (ligado: boolean) => {
    definirLembrarHardware(ligado);

    if (ligado) {
      void repositorioHardware.ler().then((perfil) => {
        if (perfil && lembrarHardwareRef.current) aplicarHardware(perfil);
      });
      return;
    }

    void repositorioHardware.apagar().catch((erro) => {
      console.error('[consulta] Não foi possível esquecer o hardware:', erro);
    });
  };

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
      if (lembrarHardwareRef.current) {
        void repositorioHardware
          .salvar({ placaVideo, processador, memoria, resolucao })
          .catch((erro) => {
            console.error('[consulta] Não foi possível lembrar o hardware:', erro);
          });
      }
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
              accessibilityLabel="Histórico"
              hitSlop={8}
              style={headerStyles.acao}
            >
              <Text style={textoStyles.linkHeader}>Histórico</Text>
            </Pressable>
          ),
        }}
      />
      <Text style={textoStyles.intro}>
        Diga o jogo e o PC. Devolvemos o menu gráfico preenchido.
      </Text>

      <Text style={textoStyles.label}>Jogo</Text>
      <View style={inputStyles.container}>
        <TextInput
          value={jogo}
          placeholder="ex: Cyberpunk 2077"
          placeholderTextColor={Cores.textoTerciario}
          onChangeText={(v) => editarCampo('jogo', v)}
          style={[inputStyles.campo, erros.jogo && inputStyles.campoErro]}
          accessibilityLabel="Jogo"
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
        label="Resolução"
        opcoes={RESOLUCOES}
        valor={resolucao}
        onChange={setResolucao}
      />

      <LembrarHardware ligado={lembrarHardware} onChange={aoAlternarLembrar} />

      <Botao
        titulo="Gerar configurações"
        tituloCarregando="Gerando"
        carregando={isLoading}
        desabilitado={desabilitado}
        onPress={gerarConfiguracoes}
      />

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
