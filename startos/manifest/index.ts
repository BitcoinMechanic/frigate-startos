import { setupManifest, T } from '@start9labs/start-sdk'
import { FRIGATE_VERSION } from '../versions'
import { long, short } from './i18n'

// `remcoros/frigate-docker` is contributor-built, so its tags are not immutable:
// the digest is what selects the image, and the tag rides along only to keep
// this readable. Both must be re-resolved together on a bump — see UPDATING.md.
const defaultBaseImage = `ghcr.io/remcoros/frigate-docker:${FRIGATE_VERSION}@sha256:218cc79bdcd300651f516d3e40ae43dcc48763329f223133c9d606f039c22f8b`

const rocmBaseImage = `ghcr.io/remcoros/frigate-docker:${FRIGATE_VERSION}-rocm@sha256:1cf651c4f3ab4a135fbdda3b4bfe172ef9c278ec4ca3a79c4c212029d20c9348`

const patchedSource = (baseImage: string) => ({
  dockerBuild: {
    dockerfile: 'Dockerfile',
    workdir: '.',
    buildArgs: { BASE_IMAGE: baseImage },
  },
})

const images = {
  generic: {
    source: patchedSource(defaultBaseImage),
    arch: ['x86_64', 'aarch64'],
    emulateMissing: false,
  },
  nvidia: {
    source: patchedSource(defaultBaseImage),
    arch: ['x86_64'],
    nvidiaContainer: true,
    emulateMissing: false,
  },
  amd: {
    source: patchedSource(rocmBaseImage),
    arch: ['x86_64'],
    emulateMissing: false,
  },
} satisfies Record<string, T.SDKManifest['images'][string]>

type Variant = keyof typeof images

const deviceRequirements: Record<Variant, T.DeviceFilter[]> = {
  generic: [],
  nvidia: [
    {
      class: 'display',
      product: null,
      vendor: null,
      driver: 'nvidia',
      description: 'An NVIDIA GPU',
    },
  ],
  amd: [
    {
      class: 'display',
      product: null,
      vendor: null,
      driver: 'amdgpu',
      description: 'An AMD GPU supported by ROCm',
    },
  ],
}

const isVariant = (value: string): value is Variant => value in images

const variant = process.env.VARIANT ?? 'generic'
if (!isVariant(variant))
  throw new Error(
    `unknown VARIANT '${variant}': expected one of ${Object.keys(images).join(', ')}`,
  )

export const manifest = setupManifest({
  id: 'frigate-blake2b',
  title: 'Frigate (BLAKE2b)',
  license: 'Apache-2.0',
  packageRepo: 'https://github.com/BitcoinMechanic/frigate-startos',
  upstreamRepo: 'https://github.com/sparrowwallet/frigate',
  marketingUrl: 'https://github.com/sparrowwallet/frigate',
  donationUrl: 'https://sparrowwallet.com/donate/',
  description: { short, long },
  volumes: ['main'],
  images: { main: images[variant] },
  hardwareAcceleration: true,
  hardwareRequirements: {
    device: deviceRequirements[variant],
  },
})
