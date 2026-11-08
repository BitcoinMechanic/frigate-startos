import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const FRIGATE_VERSION = '1.6.1'

export const current = VersionInfo.of({
  version: '1.6.1:2',
  releaseNotes: {
    en_US:
      'Updates the BLAKE2b build to Frigate 1.6.1 with server limits and shutdown fixes. Uses the separate service ID frigate-blake2b. Existing frigate installations, including 1.5.3:1, require the stopped-service volume-copy procedure in the package README to retain their index and settings. Keep the old installation for rollback and reconnect wallets to the new address.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
