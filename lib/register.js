"use strict";
exports.__esModule = true;
var kaboom_1 = require("./kaboom");
var R = require("ramda");
var cors = require("cors");
var bodyParser = require("body-parser");
var errors_1 = require("./errors");
var helpers_1 = require("./helpers");
/*################################################################
  Register Factory
  ################################################################*/
exports.registerFactory = function (serverRoutes, serverAuth, serverApp) { return function (pluginOptions) {
    var path = pathFactory(pluginOptions, serverRoutes);
    var middleware = middlewareFactory(pluginOptions, serverRoutes, serverAuth);
    return {
        /*---------------------------------------------------------------
          ROUTE
          ---------------------------------------------------------------*/
        route: function (route) {
            serverApp[method(route)](path(route), route.handler, errors_1.errorHandler);
        },
        /*---------------------------------------------------------------
          AUTH
          !!!MUTATING!!!
          ---------------------------------------------------------------*/
        auth: function (method) {
            if (serverAuth[method.name])
                throw Error("Auth with method already exists");
            serverAuth[method.name] = method.authenticate;
        }
    };
}; };
/*################################################################
  Factories
  ################################################################*/
/*---------------------------------------------------------------
  MIddleware Factory
  ---------------------------------------------------------------*/
var middlewareFactory = function (pluginOptions, serverRoutes, serverAuth) {
    var resolvers = [
        function () { return bodyParser.json(); },
        corsFactory(pluginOptions, serverRoutes),
        authFactory(serverAuth, pluginOptions, serverRoutes),
        validateBody,
        validateQuery,
        validateParams
    ];
    return function (route) { return resolvers.map(function (fn) { return fn(route); }).filter(function (fn) { return fn !== null; }); };
};
/*---------------------------------------------------------------
  Path Factory
  ---------------------------------------------------------------*/
var pathFactory = function (pluginOptions, serverRoutes) { return function (route) {
    return "" + serverRoutes.prefix + prefixOr(pluginOptions) + route.path;
}; };
/*---------------------------------------------------------------
  CORS Factory
  ---------------------------------------------------------------*/
var corsFactory = function (pluginOptions, serverRoutes) { return function (route) {
    var otherwise = serverRoutes.cors;
    var result = R.find(hasValue, [
        R.path(["options", "cors"], route),
        R.path(["routes", "cors"], pluginOptions),
        otherwise
    ]);
    if (result === true)
        return helpers_1.noop();
    if (result === false)
        return helpers_1.noop();
    return cors(result);
}; };
/*---------------------------------------------------------------
  Auth Factory
  ---------------------------------------------------------------*/
var authFactory = function (serverAuth, pluginOptions, serverRoutes) { return function (route) {
    var otherwise = serverRoutes.auth;
    var result = R.find(hasValue, [
        R.path(["options", "auth"], route),
        R.path(["routes", "auth"], pluginOptions),
        otherwise
    ]);
    if (result === false)
        return null;
    if (serverAuth[result])
        return serverAuth[result];
    return kaboom_1.BadImplementation();
}; };
/*---------------------------------------------------------------
  Validate Body
  ---------------------------------------------------------------*/
var validateBody = function (route) {
    var validator = R.path(["options", "validate", "body"], route);
    return function (request, reply, next) {
        var input = request.body;
        var results = validator.isJoi
            ? require("joi").validate(input, validator)
            : validator(input);
        if (isValid(results))
            return next();
        return kaboom_1.BadRequest({ payload: results.error.details });
    };
};
/*---------------------------------------------------------------
  Validate Query
  ---------------------------------------------------------------*/
var validateQuery = function (route) {
    var validator = R.path(["options", "validate", "query"], route);
    if (!validator)
        return null;
    return function (request, reply, next) {
        var input = request.query;
        var results = validator.isJoi
            ? require("joi").validate(input, validator)
            : validator(input);
        if (isValid(results))
            return next();
        return kaboom_1.BadRequest({ payload: results.error.details });
    };
};
/*---------------------------------------------------------------
  Validate Params
  ---------------------------------------------------------------*/
var validateParams = function (route) {
    var validator = R.path(["options", "validate", "params"], route);
    if (!validator)
        return null;
    return function (request, reply, next) {
        var input = request.params;
        var results = validator.isJoi
            ? require("joi").validate(input, validator)
            : validator(input);
        if (isValid(results))
            return next();
        return kaboom_1.BadRequest({ payload: results.error.details });
    };
};
/*################################################################
  UTILS
  ################################################################*/
var prefixOr = R.pathOr("", ["routes", "prefix"]);
var hasValue = R.complement(R.isNil);
var method = R.pipe(R.prop("method"), R.toLower);
var isValid = R.anyPass([R.equals(true), R.propEq("error", null)]);
