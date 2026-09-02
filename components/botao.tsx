import { botaoStyles, Cores, layoutStyles } from '@/styles';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

interface BotaoProps {
  titulo: string;
  tituloCarregando?: string;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: 'primario' | 'secundario';
  acessibilidade?: string;
  onPress: () => void;
}

export function Botao({
  titulo,
  tituloCarregando,
  carregando = false,
  desabilitado = false,
  variante = 'primario',
  acessibilidade,
  onPress,
}: BotaoProps) {
  const primario = variante === 'primario';

  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={acessibilidade ?? titulo}
      accessibilityState={{ disabled: desabilitado, busy: carregando }}
      style={({ pressed }) => [
        primario ? botaoStyles.primario : botaoStyles.secundario,
        desabilitado && botaoStyles.desabilitado,
        pressed && !desabilitado && botaoStyles.pressionado,
      ]}
    >
      {carregando ? (
        <View style={layoutStyles.row}>
          <ActivityIndicator color={primario ? Cores.textoInverso : Cores.acento} />
          <Text style={primario ? botaoStyles.textoPrimario : botaoStyles.textoSecundario}>
            {tituloCarregando ?? titulo}
          </Text>
        </View>
      ) : (
        <Text style={primario ? botaoStyles.textoPrimario : botaoStyles.textoSecundario}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}
