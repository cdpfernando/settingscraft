import { inputStyles, seletorStyles, textoStyles } from '@/styles';
import { Pressable, Text, View } from 'react-native';

interface SeletorOpcoesProps {
  label: string;
  opcoes: readonly string[];
  valor: string;
  erro?: string;
  onChange: (valor: string) => void;
}

export function SeletorOpcoes({
  label,
  opcoes,
  valor,
  erro,
  onChange,
}: SeletorOpcoesProps) {
  return (
    <View style={seletorStyles.grupo}>
      <Text style={textoStyles.label}>{label}</Text>
      <View style={seletorStyles.container} accessibilityRole="radiogroup">
        {opcoes.map((opcao) => {
          const selecionada = valor === opcao;
          return (
            <Pressable
              key={opcao}
              onPress={() => onChange(opcao)}
              style={({ pressed }) => [
                seletorStyles.opcao,
                selecionada && seletorStyles.opcaoAtiva,
                pressed && seletorStyles.opcaoPressionada,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selecionada }}
            >
              <Text
                style={[
                  seletorStyles.textoOpcao,
                  selecionada && seletorStyles.textoOpcaoAtiva,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {opcao}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!!erro && <Text style={inputStyles.mensagemErro}>{erro}</Text>}
    </View>
  );
}
