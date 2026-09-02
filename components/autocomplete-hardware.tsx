import { Cores, inputStyles, textoStyles } from '@/styles';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const LIMITE_SUGESTOES = 6;

interface AutocompleteHardwareProps {
  label: string;
  value: string;
  opcoes: readonly string[];
  placeholder: string;
  erro?: string;
  onChangeText: (valor: string) => void;
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function AutocompleteHardware({
  label,
  value,
  opcoes,
  placeholder,
  erro,
  onChangeText,
}: AutocompleteHardwareProps) {
  const [estaFocado, setEstaFocado] = useState(false);
  const [sugestoesVisiveis, setSugestoesVisiveis] = useState(true);

  const sugestoes = useMemo(() => {
    const busca = normalizar(value);
    if (!busca) return [];

    const termos = busca.split(/\s+/);
    return opcoes
      .filter((opcao) => {
        const opcaoNormalizada = normalizar(opcao);
        return opcaoNormalizada !== busca && termos.every((termo) => opcaoNormalizada.includes(termo));
      })
      .sort((a, b) => {
        const aComecaComBusca = normalizar(a).startsWith(busca) ? 0 : 1;
        const bComecaComBusca = normalizar(b).startsWith(busca) ? 0 : 1;
        return aComecaComBusca - bComecaComBusca || a.localeCompare(b, 'pt-BR');
      })
      .slice(0, LIMITE_SUGESTOES);
  }, [opcoes, value]);

  const mostrarSugestoes = estaFocado && sugestoesVisiveis && sugestoes.length > 0;

  const editar = (valor: string) => {
    setSugestoesVisiveis(true);
    onChangeText(valor);
  };

  const selecionar = (opcao: string) => {
    onChangeText(opcao);
    setSugestoesVisiveis(false);
  };

  return (
    <View style={inputStyles.container}>
      <Text style={textoStyles.label}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={Cores.textoTerciario}
        onChangeText={editar}
        onFocus={() => {
          setEstaFocado(true);
          setSugestoesVisiveis(true);
        }}
        onBlur={() => setEstaFocado(false)}
        autoCapitalize="words"
        autoCorrect={false}
        style={[
          inputStyles.campo,
          mostrarSugestoes && inputStyles.campoAberto,
          erro && inputStyles.campoErro,
        ]}
        accessibilityLabel={label}
      />

      {mostrarSugestoes && (
        <View style={inputStyles.listaSugestoes} accessibilityRole="menu">
          {sugestoes.map((opcao, index) => (
            <Pressable
              key={opcao}
              onPress={() => selecionar(opcao)}
              style={({ pressed }) => [
                inputStyles.sugestao,
                index < sugestoes.length - 1 && inputStyles.sugestaoComBorda,
                pressed && inputStyles.sugestaoPressionada,
              ]}
              accessibilityRole="menuitem"
            >
              <Text style={inputStyles.textoSugestao} numberOfLines={1}>
                {opcao}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!erro && <Text style={inputStyles.mensagemErro}>{erro}</Text>}
    </View>
  );
}
