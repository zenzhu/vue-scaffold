require('./check-versions')()

var config = require('../config')
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV)
}

var fs = require('fs')
var opn = require('opn')
var path = require('path')
var express = require('express')
var webpack = require('webpack')
var proxyMiddleware = require('http-proxy-middleware')
var webpackConfig = require('./webpack.dev.conf')
var HTTP_METHODS = require('http').METHODS

// default port where dev server listens for incoming traffic
var port = process.env.PORT || config.dev.port
// automatically open browser, if not set will be false
var autoOpenBrowser = !!config.dev.autoOpenBrowser
// Define HTTP proxies to your custom API backend
// https://github.com/chimurai/http-proxy-middleware
var proxyTable = config.dev.proxyTable
// Mock Directory
var mockDirectory = config.dev.mockDirectory

var app = express()
var compiler = webpack(webpackConfig)

var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true
})

var hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: () => {}
})
// force page reload when html-webpack-plugin template changes
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
})

var isFunction = (x) => {
  return Object.prototype.toString.call(x) == '[object Function]';
}

// proxy api requests
Object.keys(proxyTable).forEach(function (context) {
  var options = proxyTable[context]

  if (typeof options === 'string') {
    options = { target: options }
  }
  app.use(proxyMiddleware(options.filter || context, options))
})

var requireUncached = function (module) {
  delete require.cache[require.resolve(module)]
  return require(module)
}

;(function traverseMockDir(mockDir) {
  fs.readdirSync(mockDir).forEach(function (file) {
    var filePath = path.resolve(mockDir, file)
    var mock
    if (fs.statSync(filePath).isDirectory()) {
      traverseMockDir(filePath)
    } else {
      if (path.extname(file) !== '.js') {
        return
      }

      var path2mock = path.relative(mockDirectory, filePath)
      var point = '/' + path2mock.substring(0, path2mock.lastIndexOf('.'))

      app.use(point, function (req, res, next) {
        mock = requireUncached(filePath)
        if (isFunction(mock)) {
          mock(req, res, next)
        } else {
          var methodDefined = false
          var returned = false
          for (let method in mock) {
            if (!method.startsWith('__')) {
              continue
            }

            var rawMethod = method.toUpperCase().slice(2)
            if (HTTP_METHODS.indexOf(rawMethod) === -1) {
              continue
            }

            methodDefined = true
            if (req.method === rawMethod) {
              returned = true
              mock = mock[method]
              if (isFunction(mock)) {
                mock(req, res, next)
              } else {
                res.json(mock)
              }
              break
            }
          }

          if (!methodDefined) {
            res.json(mock)
          }

          if (!returned) {
            next()
          }
        }
      })
    }
  })
})(mockDirectory)

// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')())

// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)

// serve pure static assets
var staticPath = path.posix.join(config.dev.assetsPublicPath, config.dev.assetsSubDirectory)
app.use(staticPath, express.static('./static'))

var uri = 'http://localhost:' + port

var _resolve
var readyPromise = new Promise(resolve => {
  _resolve = resolve
})

console.log('> Starting dev server...')
devMiddleware.waitUntilValid(() => {
  console.log('> Listening at ' + uri + '\n')
  // when env is testing, don't need open it
  if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
    opn(uri)
  }
  _resolve()
})

var server = app.listen(port)

module.exports = {
  ready: readyPromise,
  close: () => {
    server.close()
  }
}
