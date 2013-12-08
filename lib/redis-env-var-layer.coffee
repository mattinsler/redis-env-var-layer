rx = /\$\{([^\}]+)\}/

resolve = (config, v) ->
  return null unless v?
  while (match = rx.exec(v))?
    v = v.replace(match[0], resolve(config, config[match[1]]))
  v

config_from_redis = (app) ->
  (done) ->
    module.exports.environment(app.environment).get true, (err, config) ->
      return done(err) if err?
      process.env[k] = resolve(config, v) for k, v of config
      done()

module.exports = (app) ->
  throw new Error('To use redis-env-var-layer you must define the REDIS_ENV_VAR_URL environment variable.') unless process.env.REDIS_ENV_VAR_URL?
  
  app.sequence('init').insert(
    'config-from-redis',
    config_from_redis(app), before: 'config'
  )

cached_client = null
module.exports.__defineGetter__ 'client', ->
  cached_client or= require('redis-builder')(url: process.env.REDIS_ENV_VAR_URL)

module.exports.environments =
  list: (cb) ->
    module.exports.client.keys('*', cb)

module.exports.environment = (env) ->
  {
    get: (key, should_resolve, cb) ->
      # get(callback)
      if typeof key is 'function'
        module.exports.client.hgetall(env, key)
      
      # get(should_resolve, callback)
      else if typeof key is 'boolean' and typeof should_resolve is 'function'
        return module.exports.client.hgetall(env, should_resolve) if key is false
        
        module.exports.client.hgetall env, (err, config) ->
          return should_resolve(err) if err?
          should_resolve(null, Object.keys(config).reduce (o, k) ->
            o[k] = resolve(config, config[k])
            o
          , {})
      
      # get(key, callback)
      else if typeof key is 'string' and typeof should_resolve is 'function'
        module.exports.client.hget(env, key, should_resolve)
      
      # get(key, should_resolve, callback)
      else if typeof key is 'string' and typeof should_resolve is 'boolean' and typeof cb is 'function'
        return module.exports.client.hget(env, key, cb) if should_resolve is false
        @get true, (err, config) ->
          return cb(err) if err?
          cb(null, config[key])
    
    set: (k, v, cb) ->
      if typeof k is 'object' and typeof v is 'function' and not cb?
        # k is an object and v is callback
        module.exports.client.hmset(env, k, v)
      else if typeof k is 'string' and v? and typeof cb is 'function'
        module.exports.client.hset(env, k, v, cb)
    
    remove: (key, cb) ->
      module.exports.client.hdel(env, key, cb)
  }
