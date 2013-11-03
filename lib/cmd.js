
var fs = require('fs')
  , path = require('path')
  , url = require('url')

  , superagent = require('superagent')
  , mkdirp = require('mkdirp')
  , crypto = require('crypto')

  , save = process.env.STRIDER_LOCAL || path.join(process.env.HOME, '.strider-local')
  , TPL = fs.readFileSync(path.join(__dirname, 'hook-template.sh'), 'utf8')
  , RMTPL = fs.readFileSync(path.join(__dirname, 'remove-template.sh'), 'utf8')

module.exports = {
  create: create,
  formatHook: formatHook,
  writeHook: writeHook,
  saveCreds: saveCreds,
  getCreds: getCreds,
  generateSecret: generateSecret
}

var validate = {
  host: function (val) {
    if (!val || val === 'l' || val === 'local') val = 'http://localhost:3000'
    var p = url.parse(val)
    if (!p.protocol || !p.host) return
    if (p.pathname && p.pathname !== '/') console.warn('Ignoring pathname from host:', p.pathname)
    return p
  },
  path: function (val) {
    var p = path.resolve(val || '.')
    return fs.existsSync(p) && p
  },
  create: function (val, p) {
    return (!val || val === '.') ? path.basename(p.path) : val
  }
}

module.exports.validate = validate

function generateSecret(callback) {
  crypto.randomBytes(32, function (err, buf) {
    callback(err, buf && buf.toString('hex'))
  })
}

function b64(x) {
  return new Buffer(x, 'utf8').toString('base64')
}
function un64(x) {
  return new Buffer(x, 'base64').toString('utf8')
}

function saveCreds(user, pass, dest) {
  fs.writeFileSync(dest || save, b64(user) + '\n' + b64(pass), 'utf8')
}

function getCreds(dest) {
  var data
  try {
    data = fs.readFileSync(dest || save, 'utf8').split('\n')
    data[0] = un64(data[0])
    data[1] = un64(data[1])
  } catch (e) {}
  return data
}

function create(options, done) {
  superagent.put(options.host + options.name + '/')
    .set('Authorization', 'basic ' + b64(options.user + ':' + options.pass))
    .send({
      display_name: options.name,
      display_url: null,
      public: false,
      provider: {
        id: 'local',
        config: {
          path: options.path,
          secret: options.secret
        }
      }
    })
    .end(function (res) {
      if (res.status < 300) return done()
      var msg = {
        401: 'not authorized',
        500: 'Server error: ' + res.text,
        400: 'bad user data'
      }[res.status] || 'Unknown error: ' + res.status + ' ' + res.text
      return done(new Error('Failed to create project: ' + msg))
    })
}

function formatRemoval(options) {
  return RMTPL.trim() + ' ' + options.host + options.name + '/api/local/' + options.secret
}

function writeRemoval(dest, options, done) {
  var fname = path.join(dest, '.git/remove-strider')
  fs.writeFile(fname, formatRemoval(options), function (err) {
    if (err) return done(err)
    fs.chmod(fname, parseInt('755', 8), done)
  })
}

function writeHook(dest, options, done) {
  mkdirp(path.join(dest, '.git/hooks'), function (err) {
    if (err) return done(err)
    var fname = path.join(dest, '.git/hooks/post-commit')
    fs.writeFile(fname, formatHook(options), function (err) {
      if (err) return done(err)
      fs.chmod(fname, parseInt('755', 8), function (err) {
        if (err) return done(err)
        writeRemoval(dest, options, done)
      })
    })
  })
}

function formatHook(options) {
  return TPL.trim() + ' ' + options.host + options.name + '/api/local/' + options.secret
}
