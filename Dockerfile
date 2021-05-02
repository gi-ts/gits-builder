FROM archlinux:latest

# Update the system and install git and the github CLI.
RUN pacman -Syu --noconfirm git github-cli

ENV NVM_DIR /usr/local/nvm
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