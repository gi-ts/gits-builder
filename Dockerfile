FROM archlinux:latest

# Update the system and install git and the github CLI.
RUN pacman -Syu --noconfirm git github-cli

# Install GNOME dependencies...
RUN pacman -Syu --noconfirm accountsservice atk cairo dbus \
harfbuzz gcr gdk-pixbuf2 gdm geoclue glib2 gobject-introspection \
ibus json-glib malcontent modemmanager libnm libnotify \
pango polkit rsvg libsoup telepathy-glib upower

RUN mkdir ./nvm-install
ENV NVM_DIR ./nvm-install
ENV NODE_VERSION v14

# Install Node Version Manager (nvm)
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash

# Install Node and nvm
RUN source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN node -v
RUN npm -v

Run npm install -g yarn

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]