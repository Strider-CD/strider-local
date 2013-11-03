
var path = require('path')
  , fs = require('fs')
  , spawn = require('child_process').spawn
  , mkdirp = require('mkdirp')
  , shellescape = require('shell-escape')

function shellEscape(one) {
  if (!one) {
    throw new Error('trying to escape nothing', one)
  }
  return shellescape([one])
}

function safespawn() {
  var c = spawn.apply(null, arguments)
  c.on('error', function (err) {
    // suppress node errors
  })
  return c
}

function cloneCmd(config, branch) {
  var args = ['clone', '--recursive', config.path, '.']
  if (branch) {
    args = args.concat(['-b', branch])
  }
  return {
    command: 'git',
    args: args
  }
}

function pull(dest, config, context, done) {
  context.cmd({
    cmd: 'git reset --hard',
    cwd: dest
  }, function (exitCode) {
    context.cmd('git pull', done)
  })
}

function gitVersion(next) {
  var child = spawn('git', ['--version'])
    , out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', function (data) {
    out += data
  })
  child.stderr.on('data', function (data) {
    out += data
  })
  child.on('close', function (code) {
    if (code) return next(new Error('Failed to get git version: ' + out))
    next(null, out)
  })
  child.on('error', function () {})
}
 

function clone(dest, config, ref, context, done) {
  context.cmd({
    cmd: cloneCmd(config),
    cwd: dest
  }, done)
}

function badCode(name, code) {
  var e = new Error(name + ' failed with code ' + code)
  e.code = code
  e.exitCode = code
  return e
}

module.exports = {
  init: function (dirs, config, job, done) {
    return done(null, {
      config: config,
      fetch: function (context, done) {
        console.log('fecth!', config)
        module.exports.fetch(dirs.data, config, job, context, done)
      }
    })
  },
  fetch: fetch
}

function checkoutRef(dest, cmd, ref, done) {
  return cmd({
    cmd: 'git checkout -qf ' + shellEscape(ref.id || ref.branch),
    cwd: dest
  }, function (exitCode) {
    done(exitCode && badCode('Checkout', exitCode))
  })
}

function fetch(dest, config, job, context, done) {
  var get = pull
    , pleaseClone = function () {
        mkdirp(dest, function () {
          clone(dest, config, job.ref, context, updateCache)
        })
      }
  if (!config.cache) return pleaseClone()

  context.cachier.get(dest, function (err) {
    if (err) return pleaseClone()
    // make sure .git exists
    fs.exists(path.join(dest, '.git'), function (exists) {
      if (exists) {
        context.comment('restored code from cache')
        return pull(dest, config, context, updateCache)
      }
      safespawn('rm', ['-rf', dest]).on('close', function (exitCode) {
        pleaseClone()
      })
    })
  })

  function updateCache(exitCode) {
    if (exitCode) return done(badCode('Command', exitCode))
    if (!config.cache) return gotten()
    context.comment('saved code to cache')
    context.cachier.update(dest, gotten)
  }

  function gotten (err) {
    if (err) return done(err)
    // fetch the ref
    if (job.ref.branch && !job.ref.fetch) {
      return checkoutRef(dest, context.cmd, job.ref, done)
    }
    fetchRef(job.ref.fetch, dest, config.auth, context, done)
  }
}

function fetchRef(what, dest, auth, context, done) {
  context.cmd({
    cmd: 'git fetch origin ' + shellEscape(what),
    cwd: dest
  }, function (exitCode) {
    if (exitCode) return done(badCode('Fetch ' + what, exitCode))
    context.cmd({
      cmd: 'git checkout -qf FETCH_HEAD',
      cwd: dest
    }, function (exitCode) {
      done(exitCode && badCode('Checkout', exitCode))
    })
  })
}


