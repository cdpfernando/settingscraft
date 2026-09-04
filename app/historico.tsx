import { Botao } from '@/components/botao';
import { formatarDataGeracao, ResultadoCard } from '@/components/resultado-card';
import { criarRepositorioCacheLocal, type ItemHistorico } from '@/service/ai/cache-local';
import { Cores, historicoStyles } from '@/styles';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';

const repositorio = criarRepositorioCacheLocal();

function resumoHardware(item: ItemHistorico): string {
  const { placaVideo, processador, memoria, resolucao } = item.consulta;
  return `${placaVideo} · ${processador} · ${memoria} · ${resolucao}`;
}

function resumoEvidencia(item: ItemHistorico): string {
  const tipo = item.resultado.evidenciaDesempenho?.tipo;
  if (tipo === 'benchmark') return 'benchmark FPSHQ';
  if (tipo === 'predicao') return 'projeção FPSHQ';
  return 'somente IA';
}

export default function Historico() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [itemSelecionado, setItemSelecionado] = useState<ItemHistorico | null>(null);

  useEffect(() => {
    let ativo = true;

    repositorio
      .listar()
      .then((resultado) => {
        if (ativo) setItens(resultado);
      })
      .catch((erro) => {
        console.error('[Historico] Não foi possível carregar o histórico:', erro);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (itemSelecionado) {
    return (
      <ScrollView contentContainerStyle={historicoStyles.tela}>
        <Stack.Screen options={{ title: itemSelecionado.consulta.jogo }} />
        <Pressable
          onPress={() => setItemSelecionado(null)}
          style={({ pressed }) => [
            historicoStyles.botaoVoltar,
            pressed && historicoStyles.itemPressionado,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao histórico"
        >
          <Text style={historicoStyles.textoBotaoVoltar}>Voltar</Text>
        </Pressable>
        <ResultadoCard
          jogo={itemSelecionado.consulta.jogo}
          resolucaoConsultada={itemSelecionado.consulta.resolucao}
          resultado={itemSelecionado.resultado}
          embutido
        />
      </ScrollView>
    );
  }

  if (carregando) {
    return (
      <View style={historicoStyles.vazioContainer}>
        <Stack.Screen options={{ title: 'Histórico' }} />
        <ActivityIndicator color={Cores.acento} />
      </View>
    );
  }

  if (itens.length === 0) {
    return (
      <View style={historicoStyles.vazioContainer}>
        <Stack.Screen options={{ title: 'Histórico' }} />
        <Text style={historicoStyles.vazioTexto}>
          Ainda não gerou nada. Quando gerar, a lista enche.
        </Text>
        <View style={historicoStyles.vazioAcao}>
          <Botao titulo="Gerar configurações" onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Histórico' }} />
      <FlatList
        contentContainerStyle={historicoStyles.tela}
        data={itens}
        keyExtractor={(item, index) => `${item.consulta.jogo}-${item.resultado.geradoEm}-${index}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setItemSelecionado(item)}
            style={({ pressed }) => [
              historicoStyles.item,
              pressed && historicoStyles.itemPressionado,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Ver resultado salvo de ${item.consulta.jogo}`}
          >
            <Text style={historicoStyles.itemJogo}>{item.consulta.jogo}</Text>
            <Text style={historicoStyles.itemHardware}>{resumoHardware(item)}</Text>
            <Text style={historicoStyles.itemRodape}>
              {resumoEvidencia(item)} · {formatarDataGeracao(item.resultado.geradoEm)}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}
