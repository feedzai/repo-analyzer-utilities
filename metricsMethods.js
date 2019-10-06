const path = require("path");
const fs = require("fs");
const util = require("util");
const logger = require("pino")({
    prettyPrint: { colorize: true },
    translateTime: false
});
const _ = require("lodash");
const readFile = util.promisify(fs.readFile);
const {executeCommandSync } = require("./utilities");


/**
 * metricsMethods
 *
 * Contains all methods responsible for calculating the metrics
 *
 * @author Henrique Dias (henrique.dias@feedzai.com)
 */

let metrics = [], metricNames = [], metricGroups = [];

// eslint-disable-next-line one-var
let lastReport;


/**
 * Used to load the metrics from the config
 * @param  {Array} metrics
 * @returns {boolean}
 */
function loadMetrics(configMetrics) {

    if (_.isArray(configMetrics)) {
        metrics = configMetrics;
        return true;
    }
    return false;
}

/**
 *Sets the local last report with `report` passed by argument
 * @param  {Array} report
 */
function setLastReport(report) {
    lastReport = report;
}

/**
 * Returns an array with the last report metrics
 * @returns {Array}
 */

function getLastReport() {
    return lastReport;
}

/**
 * Finds a repo report from the last report using a given `repoName`
 * @param  {string} repoName
 * @returns {object}
 */
function getRepoFromLastReport(repoName) {
    let repo;

    if (_.isArray(lastReport)) {
        lastReport.forEach((r) => {
            if (r.repository === repoName) {
                repo = r;
            }
        });
    }
    return repo;
}

/**
 * Groups all metrics by "group"
 * @returns {Object}
 */
function getMetricGroups() {
    return _.groupBy(metricGroups, "group");
}

/**
 * Returns the last `metricName`for a `repo`
 * @param  {object} repo
 * @param  {string} metricName
 * @returns {object | undefined}
 */
function lastReportMetric(repo, metricName) {
    let result;

    if (_.isArray(lastReport)) {
        lastReport.forEach((el) => {
            if (el.repository === repo.label) {
                el.metrics.forEach((metric) => {
                    if (metric.info.name === metricName) {
                        result = metric;
                    }
                });
            }
        });
    }

    return result;
}

/**
 * Gets last commit hash for a given repo
 * @param  {string} repoFolder
 * @returns {string}
 */
function getLastCommit(repoFolder) {
    let result = executeCommandSync(repoFolder, "git rev-parse HEAD").toString();
    result.replace("\n", "");
    return result;
}

/**
 * Runs all `metrics` (previously loaded) on a given `repo`
 * `repoFolder` and `packageJson` are used to pass information to the metric being evaluated.
 * @param  {Object} repo
 * @param  {Object} repoFolder
 * @param  {Object} packageJson
 */
async function runMetrics(repo, repoFolder, packageJson) {
    return await Promise.all(metrics.map((Metric) => {
        const current = new Metric(repo, repoFolder, packageJson);

        if (metricNames.indexOf(current.info().name) === -1) {
            metricNames.push(current.info().name);
            metricGroups.push(current.info());
        }
        let hash = getLastCommit(repoFolder);

        const lastResult = lastReportMetric(repo, current.info().name);

        if (_.isObject(lastResult) && (hash === lastResult.hashLastCommit)) {
            logger.info(`'${current.info().name}' for '${repo.label}' used from last report.`)
            return lastResult;
        }
        return current.verify().then((verify) => {
            if (verify) {
                return current.execute().then((metricResult) => {
                    if (_.isObject(metricResult) && _.isBoolean(metricResult.result)) {
                        return {
                            info: current.info(),
                            result: { result: metricResult.result.toString() },
                            hashLastCommit: hash
                        };
                    }

                    return {
                        info: current.info(),
                        result: metricResult,
                        hashLastCommit: hash
                    };
                });
            }

            logger.warn(`'${current.info().name}' metric not available for '${repo.label}' repository.`);
            return {
                info: current.info(),
                result: "-",
                hashLastCommit: hash
            };
        });
    }));
}

/**
 * Calculates all metrics for a give `repo`
 * @param  {object} repo
 * @returns {object}
 */
async function getMetricsForRepo(repo, repoFolder) {

    let packageJson;

    try {
        packageJson = JSON.parse(await readFile(path.join(repoFolder, "package.json"), "utf8"));
    } catch (error) {
        packageJson = null;
        logger.error("cannot read 'package.json'");
        return null;
    }

    if (_.isObject(packageJson)) {
        return runMetrics(repo, repoFolder, packageJson).then((res) => {
            return {
                repository: repo.label,
                metrics: res,
                installedGitHash: repo.installedGitHash,
            };
        });
    }
    throw new Error("folder does not exist");
}

function getMetricNames() {
    return metricNames;
}
module.exports = {
    runMetrics,
    loadMetrics,
    getMetricsForRepo,
    getMetricNames,
    getMetricGroups,
    setLastReport,
    getLastReport,
    getRepoFromLastReport
};
