(function() {
  var cached_client, config_from_redis, resolve, rx;

  rx = /\$\{([^\}]+)\}/;

  resolve = function(config, v) {
    var match;
    if (v == null) {
      return null;
    }
    while ((match = rx.exec(v)) != null) {
      v = v.replace(match[0], resolve(config, config[match[1]]));
    }
    return v;
  };

  config_from_redis = function(app) {
    return function(done) {
      return module.exports.environment(app.environment).get(true, function(err, config) {
        var k, v;
        if (err != null) {
          return done(err);
        }
        for (k in config) {
          v = config[k];
          process.env[k] = resolve(config, v);
        }
        return done();
      });
    };
  };

  module.exports = function(app) {
    if (process.env.REDIS_ENV_VAR_URL == null) {
      throw new Error('To use redis-env-var-layer you must define the REDIS_ENV_VAR_URL environment variable.');
    }
    return app.sequence('init').insert('config-from-redis', config_from_redis(app), {
      before: 'config'
    });
  };

  cached_client = null;

  module.exports.__defineGetter__('client', function() {
    return cached_client || (cached_client = require('redis-builder')({
      url: process.env.REDIS_ENV_VAR_URL
    }));
  });

  module.exports.environments = {
    list: function(cb) {
      return module.exports.client.keys('*', cb);
    }
  };

  module.exports.environment = function(env) {
    return {
      get: function(key, should_resolve, cb) {
        if (typeof key === 'function') {
          return module.exports.client.hgetall(env, key);
        } else if (typeof key === 'boolean' && typeof should_resolve === 'function') {
          if (key === false) {
            return module.exports.client.hgetall(env, should_resolve);
          }
          return module.exports.client.hgetall(env, function(err, config) {
            if (err != null) {
              return should_resolve(err);
            }
            return should_resolve(null, Object.keys(config).reduce(function(o, k) {
              o[k] = resolve(config, config[k]);
              return o;
            }, {}));
          });
        } else if (typeof key === 'string' && typeof should_resolve === 'function') {
          return module.exports.client.hget(env, key, should_resolve);
        } else if (typeof key === 'string' && typeof should_resolve === 'boolean' && typeof cb === 'function') {
          if (should_resolve === false) {
            return module.exports.client.hget(env, key, cb);
          }
          return this.get(true, function(err, config) {
            if (err != null) {
              return cb(err);
            }
            return cb(null, config[key]);
          });
        }
      },
      set: function(k, v, cb) {
        if (typeof k === 'object' && typeof v === 'function' && (cb == null)) {
          return module.exports.client.hmset(env, k, v);
        } else if (typeof k === 'string' && (v != null) && typeof cb === 'function') {
          return module.exports.client.hset(env, k, v, cb);
        }
      },
      remove: function(key, cb) {
        return module.exports.client.hdel(env, key, cb);
      }
    };
  };

}).call(this);
