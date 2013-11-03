#!/usr/bin/env node

var program = require('commander')
  , superagent = require('superagent')
  , async = require('async')

  , path = require('path')
  , url = require('url')

  , lib = require('../lib/cmd')
  , validate = lib.validate

program
  .version('0.0.1')
  .option('-u, --user <user>', 'specify the user email')
  .option('-p, --pass <pass>', 'specify the password')
  .option('-h, --host <host>', 'set the host. l or local expands to http://localhost:3000')
  .option('-c, --create <name>', 'name of the project to create. "." expands to the name of the directory')
  .option('-s, --secret <secret>', 'specify the secret. Otherwise it will be randomly generated')
  .option('-d, --path <path>', 'the path of the project')
  .parse(process.argv)

var tasks = [
  function (next) {
    if (program.user && program.pass) {
      lib.saveCreds(program.user, program.pass)
      return next()
    }
    var data = lib.getCreds()
    if (data && data.length === 2) {
      program.user = data[0]
      program.pass = data[1]
      return next()
    }
    program.prompt('Username: ', function (user) {
      program.password('Password: ', function (pass) {
        program.user = user
        program.pass = pass
        lib.saveCreds(user, pass)
        next()
      })
    })
  },
  function (next) {
    if (program.host) {
      if (program.host = validate.host(program.host)) return next()
      return next(new Error('Invalid host'))
    }
    program.prompt('Host (default http://localhost:3000): ', function (val) {
      if (program.host = validate.host(program.host)) return next()
      return next(new Error('Invalid host'))
    })
  },
  function (next) {
    if (program.path) {
      if (program.path = validate.path(program.path)) return next()
      return next(new Error('invalid path or does not exist'))
    }
    program.prompt('Path (default .): ', function (val) {
      if (program.path = validate.path(program.path)) return next()
      return next(new Error('invalid path or does not exist'))
    })
  },
  function (next) {
    if (program.create) {
      program.create = validate.create(program.create)
      return next()
    }
    program.prompt('Project Name (default ' + path.basename(program.path) + '): ', function (val) {
      program.create = validate.create(val, program.path)
      next()
    })
  },
  function (next) {
    if (program.secret) return next()
    lib.generateSecret(function (err, secret) {
      if (err) return next(err)
      program.secret = secret
      next()
    })
  }
]

async.series(tasks, function (err) {
  if (err) {
    console.error('Stopping. Error:', err)
    process.exit(1)
  }
  program.host.pathname = '/'
  delete program.host.hash
  delete program.host.search
  delete program.host.querystring
  var options = {
    host: url.format(program.host),
    path: program.path,
    user: program.user,
    pass: program.pass,
    secret: program.secret,
    name: 'local/' + program.create
  }

  lib.create(options, function (err) {
    if (err) {
      console.error('Failed to create project', err.message)
      process.exit(1)
    }
    lib.writeHook(options.path, options, function (err) {
      if (err) {
        console.error('Failed to register post-commit hook', err.message)
        process.exit(1)
      }
      console.log('Success! Your tests will be run when you commit. You can observe them at ' + options.host + '/' + options.name + '/.')
      process.exit(0)
    })
  })
})
