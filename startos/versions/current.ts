import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const FRIGATE_VERSION = '1.5.3.3'

export const current = VersionInfo.of({
  version: '1.5.3:10',
  releaseNotes: {
    en_US:
      'Adds support for the Bitcoin Knots BLAKE2b chain, including 164-byte v2 headers, BLAKE2b proof-of-work and block identifiers, and Electrum 1.6 header forwarding. Accepts flavored Knots and Fulcrum packages.',
    es_ES:
      'Añade compatibilidad con la cadena BLAKE2b de Bitcoin Knots, incluidos encabezados v2 de 164 bytes y el reenvío de encabezados mediante Electrum 1.6.',
    de_DE:
      'Fügt Unterstützung für die BLAKE2b-Chain von Bitcoin Knots hinzu, einschließlich 164-Byte-v2-Headern und Header-Weiterleitung über Electrum 1.6.',
    pl_PL:
      'Dodaje obsługę łańcucha BLAKE2b Bitcoin Knots, w tym 164-bajtowych nagłówków v2 i przekazywania nagłówków przez Electrum 1.6.',
    fr_FR:
      "Ajoute la prise en charge de la chaîne BLAKE2b de Bitcoin Knots, notamment les en-têtes v2 de 164 octets et leur relais via Electrum 1.6.",
  },
  migrations: {
    up: async ({ effects }) => {
      const { ensureStore } = await import('../fileModels/store.json')
      await ensureStore(effects)
    },
    down: IMPOSSIBLE,
  },
})
