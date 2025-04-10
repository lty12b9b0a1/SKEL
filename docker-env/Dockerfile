FROM python:3.10.12

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_PATH=/usr/local/lib/node_modules

# Install required system packages
RUN apt-get update && apt-get install -y \
    curl \
    cloc \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js v16.20.2
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@8.19.4

# Ensure the global node modules directory is in the PATH
ENV PATH="${NODE_PATH}/.bin:${PATH}"

# Verify Node.js and npm installation
RUN node -v && npm -v

# Install Node.js packages globally
RUN npm install -g \
    crc-32@1.2.2 \
    numjs@0.16.1

# Install Python packages
RUN pip install --no-cache-dir \
    tree-sitter==0.23.2 \
    tree-sitter-javascript==0.23.1 \
    tree-sitter-python==0.23.4 \
    transcrypt==3.9.1 \
    openai==1.7.2 \
    tiktoken==0.5.2 \
    six==1.16.0 \
    httpx==0.26.0 \
    coverage==7.6.4

# Set working directory
WORKDIR /app

# Default command
CMD ["/bin/bash"]
