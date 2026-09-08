ARG BASE_IMAGE

FROM eclipse-temurin:25-jdk AS builder

ARG FRIGATE_COMMIT=77c10e1600c9b073976bb653767877d782f5f2d6
ARG FRIGATE_SHA256=f3592c357852c5db57392e027b814197f5124f9ccc85f2a9237b026db7f034a7
ARG DRONGO_COMMIT=707fbba622200c54035a9f279535518e2aaf6319
ARG DRONGO_SHA256=780a97d21661cc79b4fe6faa7829c574a565e2db54eb33c1a36c9f8cc986a62a

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
