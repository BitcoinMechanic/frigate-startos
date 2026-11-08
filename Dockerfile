ARG BASE_IMAGE

FROM eclipse-temurin:25-jdk AS builder

ARG FRIGATE_COMMIT=f516f285f4f684328a867ea906267ba766f0b2c6
ARG FRIGATE_SHA256=a51404339247f94edf191c5b4196d9e397a4b6d9cd4fdde6344e4a957488540a
ARG DRONGO_COMMIT=6098b4acd942afb9016b212854c8d53ed5697498
ARG DRONGO_SHA256=4f54c52216812cc1e4dde4a0dab7c8c117655a694d1554d5c8b18c1d07e955d5

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl patch \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

RUN curl --fail --location --silent --show-error \
      --output frigate.tar.gz \
      "https://github.com/sparrowwallet/frigate/archive/${FRIGATE_COMMIT}.tar.gz" \
    && echo "${FRIGATE_SHA256}  frigate.tar.gz" | sha256sum --check --strict \
    && mkdir frigate \
    && tar --extract --gzip --file frigate.tar.gz --directory frigate --strip-components=1 \
    && curl --fail --location --silent --show-error \
      --output drongo.tar.gz \
      "https://github.com/privkeyio/drongo/archive/${DRONGO_COMMIT}.tar.gz" \
    && echo "${DRONGO_SHA256}  drongo.tar.gz" | sha256sum --check --strict \
    && mkdir drongo \
    && tar --extract --gzip --file drongo.tar.gz --directory drongo --strip-components=1 \
    && rm -rf frigate/drongo \
    && mv drongo frigate/drongo \
    && rm frigate.tar.gz drongo.tar.gz

COPY patches/frigate-knots.patch /tmp/frigate-knots.patch

WORKDIR /src/frigate

RUN patch --strip=1 < /tmp/frigate-knots.patch \
    && grep --quiet --fixed-strings "'--strip-native-commands'" build.gradle \
    && sed --in-place "s/'--strip-native-commands', //" build.gradle \
    && ./gradlew --no-daemon clean test jlink

FROM ${BASE_IMAGE}

# Preserve the community image's entrypoint and GPU runtime, replacing only
# the stock upstream Frigate application with the Knots-aware build.
COPY --from=builder /src/frigate/build/image /opt/frigate
