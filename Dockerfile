FROM ubuntu:xenial
LABEL version="1.0"

# Use UTF8 to avoid encoding problems with pgsql
ENV LANG C.UTF-8

# Add external repos
RUN set -ex \
    && apt-get update \
    && apt-get install -y \
      curl \
      software-properties-common \
      locales \
    && add-apt-repository -y ppa:ubuntu-toolchain-r/test \
    && curl -sL https://deb.nodesource.com/setup_6.x | bash \
    && locale-gen en_US.UTF-8 \
    && update-locale LANG=en_US.UTF-8
    
# Install dependencies and PostGIS 2.4 from sources
RUN set -ex \
    && apt-get update \
    && apt-get install -y \
      g++-4.9 \
      gcc-4.9 \
      git \
      libcairo2-dev \
      libgdal-dev \
      libgdal1i \
      libgeos-dev \
      libgif-dev \
      libjpeg8-dev \
      libjson-c-dev \
      libpango1.0-dev \
      libpixman-1-dev \
      libproj-dev \
      libprotobuf-c-dev \
      libxml2-dev \
      make \
      nodejs \
      pkg-config \
      postgresql-9.5 \
      postgresql-plpython-9.5 \
      postgresql-server-dev-9.5 \
      protobuf-c-compiler \
      redis-server \
      wget \
    && wget http://download.osgeo.org/postgis/source/postgis-2.4.0.tar.gz \
    && tar xvfz postgis-2.4.0.tar.gz \
    && cd postgis-2.4.0 \
    && ./configure \
    && make \
    && make install \
    && cd .. \
    && rm -rf postgis-2.4.0 \
    && wget http://download.redis.io/redis-stable.tar.gz \
    && tar xvzf redis-stable.tar.gz \
    && cd redis-stable \
    && make \
    && make install \
    && cd .. \
    && rm redis-stable.tar.gz \
    && rm -R redis-stable \
    && wget https://github.com/brandur/redis-cell/releases/download/v0.2.1/redis-cell-v0.2.1-x86_64-unknown-linux-gnu.tar.gz \
    && tar xvzf redis-cell-v0.2.1-x86_64-unknown-linux-gnu.tar.gz \
    && mv libredis_cell.so /lib/libredis_cell.so \
    && rm redis-cell-v0.2.1-x86_64-unknown-linux-gnu.tar.gz \
    && apt-get purge -y wget protobuf-c-compiler \
    && apt-get autoremove -y

# Configure PostgreSQL
RUN set -ex \
    && echo "listen_addresses='*'" >> /etc/postgresql/9.5/main/postgresql.conf \
    && echo "local     all       all                     trust" >  /etc/postgresql/9.5/main/pg_hba.conf \
    && echo "host      all       all       0.0.0.0/0     trust" >> /etc/postgresql/9.5/main/pg_hba.conf \
    && echo "host      all       all       ::1/128       trust" >> /etc/postgresql/9.5/main/pg_hba.conf

WORKDIR /srv
EXPOSE 5858

CMD set -ex \
    && /etc/init.d/postgresql start \
    && node -v \
    && export NPROCS=1 \
    && export JOBS=1 \
    && export CXX=g++-4.9 \
    && npm install \
    && export PGUSER=postgres \
    && npm test
