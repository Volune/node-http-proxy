var url    = require('url'),
    passes = exports;

var redirectRegex = /^30(1|2|7|8)$/;

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

[ // <--

  /**
   * If is a HTTP 1.0 request, remove chunk headers
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  function removeChunked(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      delete proxyRes.headers['transfer-encoding'];
    }
  },

  /**
   * If is a HTTP 1.0 request, set the correct connection header
   * or if connection header not present, then use `keep-alive`
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  function setConnection(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      proxyRes.headers.connection = req.headers.connection || 'close';
    } else if (!proxyRes.headers.connection) {
      proxyRes.headers.connection = req.headers.connection || 'keep-alive';
    }
  },

  function setRedirectHostRewrite(req, res, proxyRes, options) {
    if ((options.hostRewrite || options.autoRewrite || options.protocolRewrite)
        && proxyRes.headers['location']
        && redirectRegex.test(proxyRes.statusCode)) {
      var target = url.parse(options.target);
      var u = url.parse(proxyRes.headers['location']);

      // make sure the redirected host matches the target host before rewriting
      if (target.host != u.host) {
        return;
      }

      if (options.hostRewrite) {
        u.host = options.hostRewrite;
      } else if (options.autoRewrite) {
        u.host = req.headers['host'];
      }
      if (options.protocolRewrite) {
        u.protocol = options.protocolRewrite;
      }

      proxyRes.headers['location'] = u.format();
    }
  },
  /**
   * Copy headers from proxyResponse to response
   * set each header in response object.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  function writeHeaders(req, res, proxyRes, options) {
    var rewriteCookieDomainConfig = options ? options.cookieDomainRewrite : undefined;
    if(typeof rewriteCookieDomainConfig === "string") { //also test for ""
      rewriteCookieDomainConfig = {"*": rewriteCookieDomainConfig};
    }
    Object.keys(proxyRes.headers).forEach(function(key) {
      var header = proxyRes.headers[key];
      if(header != undefined){
        if(rewriteCookieDomainConfig && key.toLowerCase() === 'set-cookie') {
          header = rewriteCookieDomain(header);
        }
        res.setHeader(String(key).trim(), header);
      }
    });

    function rewriteCookieDomain(header) {
      if(Array.isArray(header)) {
        return header.map(rewriteCookieDomain);
      }
      return header.replace(/(;\s*domain=)([^;]+)/, function(match, prefix, previousDomain) {
        var newDomain;
        if(previousDomain in rewriteCookieDomainConfig) {
          newDomain = rewriteCookieDomainConfig[previousDomain];
        } else if ("*" in rewriteCookieDomainConfig) {
          newDomain = rewriteCookieDomainConfig["*"];
        } else {
          //no match, return previous domain
          return match;
        }
        if(newDomain) {
          //replace domain
          return prefix + newDomain;
        } else {
          //remove domain
          return "";
        }
      });
    }
  },

  /**
   * Set the statusCode from the proxyResponse
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  function writeStatusCode(req, res, proxyRes) {
    res.writeHead(proxyRes.statusCode);
  }

] // <--
  .forEach(function(func) {
    passes[func.name] = func;
  });
