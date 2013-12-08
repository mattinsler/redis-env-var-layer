# redis-env-var-layer

Redis Environment Variable loader for layer-cake

## Usage

Install the npm module.

```bash
$ npm install --save redis-env-var-layer
```

Set the environment variable `REDIS_ENV_VAR_URL` to the redis instance to load vars from.

## Description

Ever wanted to centralize your environment variables? It's annoying to have to copy vars between projects, so
now you don't have to!

Just set once environment variable that points to the redis endpoint and your environment variables will be
overwritten with the ones on the server.

## Environments

`redis-env-var-layer` uses `NODE_ENV` to determine the environment to load in.