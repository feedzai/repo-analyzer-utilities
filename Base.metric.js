var _ = require("lodash");
const { getAllDependencies } = require("./utilities");

/*
 * BaseMetric
 *
 * This class is the base for all the metrics implemented, it ensures that the derivated classes
 * implement 3 main methods:
 *      `info()` which returns an object that describes the metric
 *      `verify()` which verifies if a metric can be used on a give repo, returns true or false
 *      `execute()` is resposible to calculate the metric and return an object with its value
 *
 *  @author Henrique Dias (henrique.dias@feedzai.com)
 */
class BaseMetric {
    constructor(repo, repoFolder, packageJson) {
        this.repository = {};
        this.jsonPackage = {};
        this.repoFolder = {};
        this.allDependencies = {};

        if (_.isObject(repo) && _.isObject(packageJson) && _.isString(repoFolder)) {
            this.repository = repo;
            this.jsonPackage = packageJson;
            this.repoFolder = repoFolder;
            this.allDependencies = getAllDependencies(packageJson);
        } else {
            throw new Error("cannot be undefined, must use super( , , ) in derivated class");
        }

        if (!_.isFunction(this.info)) {
            throw new Error(`you must implement info: ${this.constructor.name}`);
        }

        if (!_.isFunction(this.verify)) {
            throw new Error(`you must implement verify: ${this.constructor.name}`);
        }

        if (!_.isFunction(this.execute)) {
            throw new Error(`you must implement execute: ${this.constructor.name}`);
        }
        if (!_.isFunction(this.schema)) {
            throw new Error(`you must implement schema: ${this.constructor.name}`);
        }

        if (!_.isFunction(this.constructor)) {
            throw new TypeError("You must implement the constructor");
        }
    }

    /**
     * Returns an object with the repository information: `gitRepoUrl`, `targetBranch`, `label`
     *  @returns {Object}
     */
    getRepo() {
        return this.repository;
    }

    /**
     * Returns an object with package.json info
     *  @returns {Object}
     */
    getPackage() {
        return this.jsonPackage;
    }

    /**
     * Returns a string with the RELATIVE path to cloned repository
     *  @returns {string}
     */
    getRepoFolder() {
        return this.repoFolder;
    }

    /**
     * Returns all dependencies
     * @returns {Object}
     */
    getAllDependencies() {
        return this.allDependencies;
    }
}

module.exports = BaseMetric;
