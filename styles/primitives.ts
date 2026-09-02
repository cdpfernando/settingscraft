import { StyleSheet } from 'react-native';
import { Controle, Cores, Espaco, Fonte, Raio } from './tokens';

export const layoutStyles = StyleSheet.create({
  telaScroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: Cores.fundoBase,
    paddingHorizontal: Espaco.xl,
    paddingTop: Espaco.lg,
    paddingBottom: Espaco.xxl,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.sm,
  },

  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.md,
  },
});

export const textoStyles = StyleSheet.create({
  intro: {
    fontSize: Fonte.tamanhoMd,
    fontWeight: Fonte.pesoNormal,
    color: Cores.textoSecundario,
    lineHeight: Fonte.alturaLinhaLarga,
    marginBottom: Espaco.xl,
  },

  label: {
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoMedio,
    color: Cores.textoSecundario,
    alignSelf: 'flex-start',
    marginBottom: Espaco.sm,
  },

  tituloCard: {
    fontSize: Fonte.tamanhoLg,
    fontWeight: Fonte.pesoSemibold,
    color: Cores.textoPrimario,
  },

  metaCard: {
    fontSize: Fonte.tamanhoSm,
    color: Cores.textoSecundario,
    marginTop: Espaco.xs,
    marginBottom: Espaco.lg,
  },

  linkHeader: {
    fontSize: Fonte.tamanhoMd,
    fontWeight: Fonte.pesoSemibold,
    color: Cores.acento,
  },
});

export const headerStyles = StyleSheet.create({
  acao: {
    minHeight: Controle.toqueMinimo,
    justifyContent: 'center',
    paddingHorizontal: Espaco.sm,
  },
});

export const inputStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Espaco.lg,
  },

  campo: {
    width: '100%',
    height: Controle.altura,
    backgroundColor: Cores.fundoCard,
    borderRadius: Raio.sm,
    paddingHorizontal: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
    color: Cores.textoPrimario,
    fontSize: Fonte.tamanhoMd,
  },

  campoAberto: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  campoErro: {
    borderColor: Cores.erro,
  },

  mensagemErro: {
    fontSize: Fonte.tamanhoXs,
    color: Cores.erro,
    marginTop: Espaco.xs,
  },

  listaSugestoes: {
    width: '100%',
    backgroundColor: Cores.fundoCard,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Cores.fundoBorda,
    borderBottomLeftRadius: Raio.sm,
    borderBottomRightRadius: Raio.sm,
    overflow: 'hidden',
  },

  sugestao: {
    minHeight: Controle.toqueMinimo,
    justifyContent: 'center',
    paddingHorizontal: Espaco.lg,
    paddingVertical: Espaco.sm,
  },

  sugestaoComBorda: {
    borderBottomWidth: 1,
    borderBottomColor: Cores.fundoBorda,
  },

  sugestaoPressionada: {
    backgroundColor: Cores.fundoLinha,
  },

  textoSugestao: {
    color: Cores.textoPrimario,
    fontSize: Fonte.tamanhoMd,
  },
});

export const alertaStyles = StyleSheet.create({
  erro: {
    backgroundColor: Cores.erroFundo,
    borderRadius: Raio.sm,
    borderWidth: 1,
    borderColor: Cores.erro,
    padding: Espaco.md,
    marginTop: Espaco.lg,
  },

  textoErro: {
    color: Cores.erro,
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoMedio,
    lineHeight: Fonte.alturaLinhaNormal,
  },
});

export const botaoStyles = StyleSheet.create({
  primario: {
    backgroundColor: Cores.acento,
    minHeight: Controle.altura,
    alignItems: 'center',
    borderRadius: Raio.sm,
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: Espaco.lg,
  },

  secundario: {
    backgroundColor: Cores.transparente,
    minHeight: Controle.altura,
    alignItems: 'center',
    borderRadius: Raio.sm,
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
    marginTop: Espaco.md,
    paddingHorizontal: Espaco.lg,
  },

  desabilitado: {
    opacity: 0.5,
  },

  pressionado: {
    transform: [{ scale: 0.96 }],
  },

  textoPrimario: {
    fontWeight: Fonte.pesoSemibold,
    fontSize: Fonte.tamanhoMd,
    color: Cores.textoInverso,
  },

  textoSecundario: {
    fontWeight: Fonte.pesoSemibold,
    fontSize: Fonte.tamanhoMd,
    color: Cores.textoPrimario,
  },
});

export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: Cores.fundoCard,
    marginTop: Espaco.xxl,
    width: '100%',
    borderRadius: Raio.lg,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
  },

  containerEmbutido: {
    marginTop: 0,
  },

  linhaConfig: {
    backgroundColor: Cores.fundoLinha,
    borderRadius: Raio.sm,
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.md,
    marginBottom: Espaco.sm,
  },

  nomeConfig: {
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoMedio,
    color: Cores.textoSecundario,
    flex: 1,
  },

  textoValor: {
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoSemibold,
    fontFamily: Fonte.mono,
    fontVariant: ['tabular-nums'],
    color: Cores.textoPrimario,
    textAlign: 'right',
    maxWidth: '48%',
  },

  justificativa: {
    fontSize: Fonte.tamanhoXs,
    color: Cores.textoTerciario,
    marginTop: Espaco.sm,
    lineHeight: Fonte.alturaLinhaNormal,
  },

  textoFps: {
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoSemibold,
    fontFamily: Fonte.mono,
    fontVariant: ['tabular-nums'],
    color: Cores.acento,
    textAlign: 'right',
    maxWidth: '48%',
  },

  seloOrigem: {
    marginTop: Espaco.md,
  },

  textoOrigem: {
    color: Cores.textoTerciario,
    fontSize: Fonte.tamanhoXs,
    lineHeight: Fonte.alturaLinhaNormal,
  },
});

export const seletorStyles = StyleSheet.create({
  grupo: {
    width: '100%',
    marginBottom: Espaco.lg,
  },

  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.sm,
    width: '100%',
  },

  opcao: {
    minWidth: 88,
    minHeight: Controle.toqueMinimo,
    flexGrow: 1,
    flexBasis: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.sm,
    borderRadius: Raio.sm,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
    backgroundColor: Cores.fundoCard,
  },

  opcaoAtiva: {
    borderColor: Cores.acento,
    backgroundColor: Cores.acentoSuave,
  },

  opcaoPressionada: {
    transform: [{ scale: 0.96 }],
  },

  textoOpcao: {
    fontSize: Fonte.tamanhoSm,
    color: Cores.textoSecundario,
    fontWeight: Fonte.pesoMedio,
    textAlign: 'center',
  },

  textoOpcaoAtiva: {
    color: Cores.acento,
    fontWeight: Fonte.pesoSemibold,
  },
});

export const historicoStyles = StyleSheet.create({
  tela: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: Cores.fundoBase,
    paddingHorizontal: Espaco.xl,
    paddingTop: Espaco.lg,
    paddingBottom: Espaco.xxl,
  },

  item: {
    backgroundColor: Cores.fundoCard,
    borderRadius: Raio.lg,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
    padding: Espaco.lg,
    marginBottom: Espaco.md,
  },

  itemPressionado: {
    transform: [{ scale: 0.96 }],
  },

  itemJogo: {
    fontSize: Fonte.tamanhoLg,
    fontWeight: Fonte.pesoSemibold,
    color: Cores.textoPrimario,
    marginBottom: Espaco.xs,
  },

  itemHardware: {
    fontSize: Fonte.tamanhoSm,
    color: Cores.textoSecundario,
    marginBottom: Espaco.sm,
    lineHeight: Fonte.alturaLinhaNormal,
  },

  itemRodape: {
    fontSize: Fonte.tamanhoXs,
    color: Cores.textoTerciario,
    fontVariant: ['tabular-nums'],
  },

  vazioContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: Cores.fundoBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espaco.xl,
    gap: Espaco.lg,
  },

  vazioAcao: {
    alignSelf: 'stretch',
  },

  vazioTexto: {
    fontSize: Fonte.tamanhoMd,
    color: Cores.textoSecundario,
    textAlign: 'center',
    lineHeight: Fonte.alturaLinhaLarga,
  },

  botaoVoltar: {
    minHeight: Controle.toqueMinimo,
    justifyContent: 'center',
    marginBottom: Espaco.lg,
    alignSelf: 'flex-start',
  },

  textoBotaoVoltar: {
    color: Cores.acento,
    fontSize: Fonte.tamanhoMd,
    fontWeight: Fonte.pesoSemibold,
  },
});

export const lembrarStyles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.md,
    minHeight: Controle.toqueMinimo,
    width: '100%',
    marginTop: Espaco.sm,
    marginBottom: Espaco.xl,
    paddingVertical: Espaco.sm,
  },

  linhaPressionada: {
    opacity: 0.7,
  },

  rotulo: {
    flex: 1,
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoMedio,
    color: Cores.textoSecundario,
    lineHeight: Fonte.alturaLinhaNormal,
  },

  interruptor: {
    pointerEvents: 'none',
  },
});
