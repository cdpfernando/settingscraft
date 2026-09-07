import {
  PLACAS_VIDEO,
  PROCESSADORES,
} from '@/assets/data/hardware';
import { AutocompleteHardware } from '@/components/autocomplete-hardware';
import { Botao } from '@/components/botao';
import { LembrarHardware } from '@/components/lembrar-hardware';
import { ResultadoCard } from '@/components/resultado-card';
import { SeletorOpcoes } from '@/components/seletor-opcoes';
import { recomendadorPadrao } from '@/service/ai/recomendador-padrao';
import type { Resultado } from '@/service/ai/schema';
import {
  criarConsultaConfiguracoes,
  OPCOES_MEMORIA,
  RESOLUCOES,
  type CampoConsultaConfiguracoes,
  type ConsultaConfiguracoes,
  type ErrosConsultaConfiguracoes,
  type MotivoConsultaInvalida,
} from '@/service/consulta-configuracoes';
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

type CampoEditavel = Exclude<CampoConsultaConfiguracoes, 'resolucao'>;
type Erros = Partial<Record<CampoConsultaConfiguracoes, string>>;

const MENSAGENS_VALIDACAO: Record<MotivoConsultaInvalida, string> = {
  obrigatorio: 'Campo obrigatório',
  tipo_invalido: 'Valor inválido',
  opcao_nao_suportada: 'Opção não suportada',
};

function traduzirErros(erros: ErrosConsultaConfiguracoes): Erros {
  return Object.fromEntries(
    Object.entries(erros).map(([campo, motivo]) => [
      campo,
      MENSAGENS_VALIDACAO[motivo as MotivoConsultaInvalida],
    ]),
  );
}

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
  const [consultaExibida, setConsultaExibida] = useState<ConsultaConfiguracoes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGerandoNovamente, setIsGerandoNovamente] = useState(false);
  const lembrarHardwareRef = useRef(false);

  const desabilitado = isLoading || isGerandoNovamente;

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
      void repositorioHardware
        .ler()
        .then((perfil) => {
          if (perfil && lembrarHardwareRef.current) aplicarHardware(perfil);
        })
        .catch((erro) => {
          console.error('[consulta] Não foi possível ler o hardware lembrado:', erro);
        });
      return;
    }

    void repositorioHardware.apagar().catch((erro) => {
      console.error('[consulta] Não foi possível esquecer o hardware:', erro);
    });
  };

  const editarCampo = (campo: CampoEditavel, valor: string) => {
    if (campo === 'jogo') setJogo(valor);
    else if (campo === 'placaVideo') setPlacaVideo(valor);
    else if (campo === 'processador') setProcessador(valor);
    else setMemoria(valor);

    if (erros[campo]) {
      setErros((atual) => ({ ...atual, [campo]: undefined }));
    }
  };

  const editarResolucao = (valor: string) => {
    setResolucao(valor);
    if (erros.resolucao) {
      setErros((atual) => ({ ...atual, resolucao: undefined }));
    }
  };

  const construirConsultaFormulario = (): ConsultaConfiguracoes | null => {
    const criacao = criarConsultaConfiguracoes({
      jogo,
      placaVideo,
      processador,
      memoria,
      resolucao,
    });

    if (!criacao.ok) {
      setErros(traduzirErros(criacao.erros));
      return null;
    }

    setErros({});
    return criacao.consulta;
  };

  const salvarHardwareSePreferido = (consulta: ConsultaConfiguracoes) => {
    if (!lembrarHardwareRef.current) return;

    void repositorioHardware
      .salvar({
        placaVideo: consulta.placaVideo,
        processador: consulta.processador,
        memoria: consulta.memoria,
        resolucao: consulta.resolucao,
      })
      .catch((erro) => {
        console.error('[consulta] Não foi possível lembrar o hardware:', erro);
      });
  };

  const consultar = async (
    forcarNovaRecomendacao: boolean,
    definirCarregando: (valor: boolean) => void,
  ) => {
    if (desabilitado) return;
    const consulta = construirConsultaFormulario();
    if (!consulta) return;

    salvarHardwareSePreferido(consulta);

    Keyboard.dismiss();
    if (!forcarNovaRecomendacao) setResultado(null);
    setErroApi('');
    definirCarregando(true);

    const resposta = await recomendadorPadrao.consultarConfiguracoes(
      consulta,
      { forcarNovaRecomendacao },
    );

    if (resposta.ok) {
      setResultado(resposta.resultado);
      setConsultaExibida(consulta);
    } else {
      setErroApi(resposta.erro);
    }
    definirCarregando(false);
  };

  const gerarConfiguracoes = () => {
    void consultar(false, setIsLoading);
  };

  const gerarNovamente = () => {
    void consultar(true, setIsGerandoNovamente);
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
        erro={erros.resolucao}
        onChange={editarResolucao}
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

      {!!resultado && !!consultaExibida && (
        <ResultadoCard
          jogo={consultaExibida.jogo}
          resolucaoConsultada={consultaExibida.resolucao}
          resultado={resultado}
          aoGerarNovamente={gerarNovamente}
          gerandoNovamente={isGerandoNovamente}
          desabilitado={desabilitado}
        />
      )}
    </ScrollView>
  );
}
