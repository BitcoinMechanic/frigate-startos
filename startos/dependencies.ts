import { store } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { autoconfig } from 'bitcoin-core-startos/startos/actions/config/autoconfig'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  await sdk.action.createTask(effects, 'bitcoind', autoconfig, 'critical', {
    input: {
      kind: 'partial',
      accept: [{ prune: 0, txindex: true, zmqEnabled: true }],
      set: { prune: 0, txindex: true, zmqEnabled: true },
    },
    reason: i18n(
      'Frigate requires txindex, pruning disabled, and ZMQ enabled in Bitcoin.',
    ),
    when: { condition: 'input-not-matches', once: false },
  })

  const selection = await store
    .read((value) => value.electrumServer)
    .const(effects)

  return {
    bitcoind: {
      kind: 'running',
      // The Knots package uses a flavored Exver (for example
      // #knots:29.4:8), which is incomparable with an unflavored range.
      versionRange: '*',
      healthChecks: ['bitcoind', 'sync-progress'],
    },
    ...(selection === 'fulcrum'
      ? {
          fulcrum: {
            kind: 'running',
            // Accept BLAKE2b-flavored Fulcrum builds. Requiring only the
            // primary check lets Frigate and Fulcrum initial-sync together.
            versionRange: '*',
            healthChecks: ['primary'],
          },
        }
      : {}),
  }
})
