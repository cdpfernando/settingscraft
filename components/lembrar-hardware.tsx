import { Cores, lembrarStyles } from '@/styles';
import { Pressable, Switch, Text } from 'react-native';

interface LembrarHardwareProps {
  ligado: boolean;
  onChange: (ligado: boolean) => void;
}

export function LembrarHardware({ ligado, onChange }: LembrarHardwareProps) {
  const rotulo = 'Lembrar hardware para as próximas consultas';

  return (
    <Pressable
      onPress={() => onChange(!ligado)}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado }}
      accessibilityLabel={rotulo}
      style={({ pressed }) => [lembrarStyles.linha, pressed && lembrarStyles.linhaPressionada]}
    >
      <Text style={lembrarStyles.rotulo} accessible={false}>
        {rotulo}
      </Text>
      <Switch
        value={ligado}
        onValueChange={onChange}
        trackColor={{ false: Cores.fundoBorda, true: Cores.acento }}
        thumbColor={ligado ? Cores.textoInverso : Cores.textoPrimario}
        ios_backgroundColor={Cores.fundoBorda}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={lembrarStyles.interruptor}
      />
    </Pressable>
  );
}
