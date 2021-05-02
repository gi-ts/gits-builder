FROM archlinux:latest

# Update the system and install git, node, and the github CLI.
RUN pacman -Syu --noconfirm git github-cli nodejs npm

# Install GNOME dependencies...
RUN pacman -Syu --noconfirm accountsservice atk cairo dbus \
harfbuzz gcr gdk-pixbuf2 gdm geoclue glib2 gobject-introspection \
ibus json-glib malcontent modemmanager libnm libnotify \
pango polkit librsvg libsoup telepathy-glib upower

RUN node -v
RUN npm -v

Run npm install -g yarn

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]