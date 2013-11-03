
var utils = require('strider-git/lib')
  , gravatar = require('gravatar')
  , exec = require('child_process').exec

module.exports = {
  config: {
    path: String,
    scm: String,
    secret: String,
    cache: Boolean
  },
  getBranches: function (userConfig, config, project, done) {
    exec('git ls-remote -h ' + config.path, function (err, stdout, stderr) {
      if (err) return done(err)
      utils.processBranches(stdout, done)
    })
  },
  // native git doesn't have a great way to just get a single file at an arbitrary revision
  fastFile: false,
  getFile: function (filename, ref, config, project, done) {
    done(new Error('not implemented'));
    // utils.gitcmd('git archive --remote=' + url + ' ' + (ref.fetch || ref.id) + ' .strider.json', ...);
  },
  routes: function (app, context) {
    app.anon.post(':secret', function (req, res) {
      var config = req.providerConfig()
      console.log('got req~', req.body)
      if (req.params.secret !== config.secret) {
        return res.send(400, 'Invalid Secret')
      }
      res.send(204)
      var branch = req.project.branch(req.body.branch)
        , job = makeJob(req.body, req)
      if (branch) {
        context.emitter.emit('job.prepare', job)
        return 
      }
      req.project.addBranch(req.body.branch, function (err) {
        if (err) return console.error('failed to add branch: ', err.message, err.stack)
        context.emitter.emit('job.prepare', job)
      })
    })
  }
}

function makeJob(body, req) {
  return {
    type: 'TEST_ONLY',
    trigger: {
      type: 'commit',
      author: {
        email: body.email,
        image: gravatar.url(body.email, {}, true)
      },
      url: null,
      message: body.message,
      timestamp: body.timestamp,
      source: {
        type: 'plugin',
        plugin: 'local'
      }
    },
    project: req.project.name,
    ref: {
      branch: body.branch,
      id: body.id
    },
    user_id: req.project.creator._id,
    created: new Date()
  }
}
