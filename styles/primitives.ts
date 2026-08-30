/**
 * Primitivos de estilo do SettingsCraft
 *
 * StyleSheets reutilizáveis que consomem os tokens.
 * As telas não escrevem StyleSheet.create — importam daqui.
 */
import { StyleSheet } from 'react-native';
import { Cores, Espaco, Fonte, Raio } from './tokens';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export const layoutStyles = StyleSheet.create({
  /** Tela principal: scroll com padding e fundo escuro */
  telaScroll: {
    flexGrow: 1,
    backgroundColor: Cores.fundoBase,
    padding: Espaco.xl,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------
export const textoStyles = StyleSheet.create({
  display: {
    fontSize: Fonte.tamanhoDisplay,
    fontWeight: Fonte.pesoBold,
    color: Cores.textoPrimario,
    marginBottom: Espaco.sm,
  },

  subtitulo: {
    fontSize: Fonte.tamanhoMd,
    fontWeight: Fonte.pesoNormal,
    color: Cores.textoSecundario,
    marginBottom: Espaco.xl,
  },

  label: {
    fontSize: Fonte.tamanhoMd,
    fontWeight: Fonte.pesoSemibold,
    color: Cores.textoSecundario,
    alignSelf: 'flex-start',
    marginBottom: Espaco.sm,
  },

  corpoCard: {
    fontSize: Fonte.tamanhoMd,
    color: Cores.textoSecundario,
    lineHeight: Fonte.alturaLinhaLarga,
  },

  tituloCard: {
    fontSize: Fonte.tamanhoLg,
    fontWeight: Fonte.pesoBold,
    color: Cores.textoPrimario,
    marginBottom: Espaco.lg,
    paddingBottom: Espaco.md,
    borderBottomWidth: 1,
    borderBottomColor: Cores.fundoBorda,
  },
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export const inputStyles = StyleSheet.create({
  campo: {
    width: '100%',
    height: 50,
    backgroundColor: Cores.fundoCard,
    borderRadius: Raio.md,
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
    marginBottom: Espaco.lg,
    color: Cores.textoPrimario,
    fontSize: Fonte.tamanhoMd,
  },
});

// ---------------------------------------------------------------------------
// Botão principal
// ---------------------------------------------------------------------------
export const botaoStyles = StyleSheet.create({
  primario: {
    backgroundColor: Cores.acento,
    height: 50,
    alignItems: 'center',
    borderRadius: Raio.md,
    justifyContent: 'center',
    width: '100%',
    marginBottom: Espaco.sm,
  },

  primarioDesabilitado: {
    opacity: 0.5,
  },

  textoPrimario: {
    fontWeight: Fonte.pesoBold,
    fontSize: Fonte.tamanhoMd,
    color: Cores.textoInverso,
  },
});

// ---------------------------------------------------------------------------
// Card de resultado
// ---------------------------------------------------------------------------
export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: Cores.fundoCard,
    marginTop: Espaco.xxl,
    width: '100%',
    borderRadius: Raio.lg,
    padding: Espaco.xl,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
  },

  linhaConfig: {
    backgroundColor: Cores.fundoLinha,
    borderRadius: Raio.md,
    padding: Espaco.md,
    marginBottom: Espaco.sm,
    borderLeftWidth: 3,
    borderLeftColor: Cores.acento,
  },

  nomeConfig: {
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoSemibold,
    color: Cores.textoSecundario,
    flex: 1,
  },

  badgeValor: {
    backgroundColor: Cores.acentoSombra,
    borderRadius: Raio.sm,
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.xs,
    borderWidth: 1,
    borderColor: Cores.acento,
  },

  textoValor: {
    fontSize: Fonte.tamanhoSm,
    fontWeight: Fonte.pesoBold,
    color: Cores.acento,
  },

  justificativa: {
    fontSize: Fonte.tamanhoXs,
    color: Cores.textoTerciario,
    marginTop: Espaco.sm,
    fontStyle: 'italic',
  },

  badgeFps: {
    backgroundColor: Cores.fundoLinha,
    borderRadius: Raio.md,
    padding: Espaco.md,
    marginTop: Espaco.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.acento,
  },

  textoFps: {
    fontSize: Fonte.tamanhoLg,
    fontWeight: Fonte.pesoBold,
    color: Cores.acento,
  },
});

// ---------------------------------------------------------------------------
// Seletor de resolução
// ---------------------------------------------------------------------------
export const resolucaoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.sm,
    marginBottom: Espaco.xl,
    width: '100%',
  },

  botao: {
    paddingHorizontal: Espaco.md,
    paddingVertical: Espaco.sm,
    borderRadius: Raio.sm,
    borderWidth: 1,
    borderColor: Cores.fundoBorda,
    backgroundColor: Cores.fundoCard,
  },

  botaoAtivo: {
    borderColor: Cores.acento,
    backgroundColor: Cores.acentoSombra,
  },

  textoBotao: {
    fontSize: Fonte.tamanhoSm,
    color: Cores.textoSecundario,
    fontWeight: Fonte.pesoMedio,
  },

  textoBotaoAtivo: {
    color: Cores.acento,
    fontWeight: Fonte.pesoSemibold,
  },
});
