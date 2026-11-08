import { sdk } from '../sdk'
import { i18n } from '../i18n'
import {
  createDefaultConfig,
  config,
  ElectrumServerType,
  indexStartHeightDefault,
  isCacheSize,
} from '../fileModels/config.toml'
import { ensureStore, store } from '../fileModels/store.json'

const { InputSpec, Value, Variants } = sdk

const inputSpec = InputSpec.of({
  electrumServer: Value.dynamicUnion(async ({ effects }) => {
    const installedPackages = await effects.getInstalledPackages()
    let serverType: ElectrumServerType = 'none'
    const disabled: ElectrumServerType[] = []

    if (installedPackages.includes('fulcrum')) {
      serverType = 'fulcrum'
    } else {
      disabled.push('fulcrum')
    }

    return {
      name: i18n('Electrum Server'),
      description: i18n(
        'Where Frigate sends the Electrum requests it does not answer itself, address lookups included. Frigate answers Silent Payments requests on its own.\n- Fulcrum: Fulcrum on this server.\n- None: no backend; wallets get Silent Payments results only.',
      ),
      default: serverType,
      disabled: disabled,
      variants: Variants.of({
        fulcrum: {
          name:
            i18n('Fulcrum (recommended)') +
            (disabled.includes('fulcrum') ? ' ' + i18n('(not installed)') : ''),
          spec: InputSpec.of({}),
        },
        none: {
          name: i18n('None (not recommended)'),
          spec: InputSpec.of({}),
        },
      }),
    }
  }),
  advanced: Value.object(
    {
      name: i18n('Advanced settings'),
      description: null,
    },
    InputSpec.of({
      indexStartHeight: Value.number({
        name: i18n('Index Start Height'),
        description: i18n(
          'Blocks below this height are not indexed, so Silent Payments in them are not found.',
        ),
        required: true,
        integer: true,
        min: 0,
        max: null,
        default: indexStartHeightDefault,
      }),
      scriptPubKeyCacheSize: Value.select({
        name: i18n('Script PubKey Cache Size'),
        description: i18n(
          'How many scriptPubKeys Frigate keeps in memory while indexing. A larger cache indexes faster and uses more RAM; 10M uses about 4 GB.',
        ),
        values: {
          '1M': '1M',
          '5M': '5M',
          '10M': i18n('10M (default)'),
          '20M': '20M',
          '50M': '50M',
        },
        default: '10M',
      }),
      computeBackend: Value.select({
        name: i18n('Compute Backend'),
        description: i18n(
          'Hardware used for historical Silent Payments scans. Mempool and new-block scans always run on the CPU.\n- Auto (prefer GPU): the GPU if one is detected, otherwise the CPU.\n- GPU only: always the GPU.\n- CPU only: never the GPU.',
        ),
        values: {
          AUTO: i18n('Auto (prefer GPU)'),
          GPU: i18n('GPU only'),
          CPU: i18n('CPU only'),
        },
        default: 'AUTO',
      }),
      batchSize: Value.number({
        name: i18n('Batch Size'),
        description: i18n(
          'Transactions processed per GPU dispatch. If scanning hangs or becomes unstable on an older GPU, try 10,000 to 50,000.',
        ),
        required: true,
        integer: true,
        min: 1,
        max: null,
        default: 300000,
      }),
    }),
  ),
})

export const setConfig = sdk.Action.withInput(
  'config',

  async ({ effects }) => ({
    name: i18n('Configure Frigate'),
    description: i18n('Set or update Frigate configuration settings.'),
    warning: null,
    allowedStatuses: 'any',
    group: i18n('Configuration'),
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    await createDefaultConfig(effects)
    await ensureStore(effects)
    const currentConfig = (await config.read().once())!
    const currentStore = (await store.read().once())!

    return {
      electrumServer: {
        selection: currentStore.electrumServer,
        value: {},
      },
      advanced: {
        indexStartHeight: currentConfig.index.startHeight,
        scriptPubKeyCacheSize: isCacheSize(currentConfig.index.cacheSize)
          ? currentConfig.index.cacheSize
          : '10M',
        computeBackend: currentConfig.scan.computeBackend,
        batchSize: currentConfig.scan.batchSize,
      },
    }
  },

  async ({ effects, input }) => {
    await store.merge(effects, {
      electrumServer: input.electrumServer.selection,
    })
    await config.merge(effects, {
      index: {
        startHeight: input.advanced.indexStartHeight,
        cacheSize: input.advanced.scriptPubKeyCacheSize,
      },
      scan: {
        computeBackend: input.advanced.computeBackend,
        batchSize: input.advanced.batchSize,
      },
    })
  },
)
