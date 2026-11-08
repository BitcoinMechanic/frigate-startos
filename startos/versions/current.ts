import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const FRIGATE_VERSION = '1.6.1'

export const current = VersionInfo.of({
  version: '1.6.1:3',
  releaseNotes: {
    en_US:
      'Fixes changing Index Start Height with an existing database: stop Frigate, open Configure Frigate, set the height and enable Rebuild Index, save, then start it. Existing databases resume from their checkpoint unless explicitly rebuilt. New installations default to Taproot activation (709632). Existing settings and indexes are preserved on upgrade; if you already changed the height in an earlier version, enable Rebuild Index once to apply it.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
