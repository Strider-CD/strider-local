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

function auth(user, pass, next) {
  if (user && pass) {
    lib.saveCreds(user, pass)
    return next(null, user, pass)
  }
  var data = lib.getCreds()
  if (data && data.length === 2) {
    user = data[0]
    pass = data[1]
    return next(null, user, pass)
  }
  program.prompt('Username: ', function (user) {
    program.password('Password: ', function (pass) {
      lib.saveCreds(user, pass)
      next(null, user, pass)
    })
  })
}

function get(program, name, prompt, next) {
  if (program[name]) {
    if (program.host = validate.host(program[name], program)) return next()
    return next(new Error('Invalid ' + name))
  }
  program.prompt(prompt, function (val) {
    if (program[name] = validate[name](program[name], program)) return next()
    return next(new Error('Invalid ' + name))
  })
}

function tasks(program) {
  var getone = get.bind(null, program)
  return [
    function (next) {
      auth(program.user, program.pass, function (err, user, pass) {
        if (err) return next(err)
        program.user = user
        program.pass = pass
        next()
      })
    },
    function (next) {
      getone('host', 'Host (default http://localhost:3000): ', next)
    },
    function (next) {
      getone('path', 'Path (default .): ', next)
    },
    function (next) {
      getone('create', 'Project Name (default ' + path.basename(program.path) + '): ', next)
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
}

function main(program) {
  async.series(tasks(program), function (err) {
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
}

main(program)
