import { T } from '@start9labs/start-sdk'
import { autoconfig } from 'bitcoin-core-startos/startos/actions/config/autoconfig'
import { store } from './fileModels/store.json'
import { i18n } from './i18n'
import {
  bitcoindDescription,
  electrumBackendDescription,
} from './manifest/i18n'
import { sdk } from './sdk'

const selection = (effects: T.Effects) =>
  store.read((value) => value.electrumServer).const(effects)

const bitcoind = sdk.Dependency.required('bitcoind', {
  description: bitcoindDescription,
  metadata: {
    title: 'Bitcoin (BLAKE2b)',
    icon: 'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/feec0b1dae42961a257948fe39b40caf8672fce1/dep-icon.svg',
  },
  // BLAKE2b packages use flavored versions incomparable with stock ranges.
  versionRange: '*',
  kind: 'running',
  healthChecks: ['bitcoind', 'sync-progress'],
}).withInit(async (effects) => {
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
})

const fulcrum = sdk.Dependency.optional('fulcrum', {
  description: electrumBackendDescription,
  metadata: {
    title: 'Fulcrum (BLAKE2b)',
    icon: 'https://raw.githubusercontent.com/Start9Labs/fulcrum-startos/refs/heads/master/icon.png',
  },
  versionRange: '*',
  kind: 'running',
  healthChecks: ['primary'],
  enabled: async ({ effects }) => (await selection(effects)) === 'fulcrum',
})

export const dependencies = sdk.Dependencies.of()
  .addDependency(bitcoind)
  .addDependency(fulcrum)
