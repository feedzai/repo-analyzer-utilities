const util = require("util");
const fs = require("fs");
const exec = util.promisify(require("child_process").exec);
const _ = require("lodash");
const logger = require("pino")({
    prettyPrint: { colorize: true },
    translateTime: false
});
const hasYarn = require("has-yarn");
const {
    fileExists,
    getRepoFolder,
    executeCommand,
    executeCommandSync,
    executeCommandGetOutput
} = require("./utilities");

/**
 * repoMethods
 *
 * Contains all methods related with direct handling of repositories.
 *
 * @author Luis Cardoso (luis.cardoso@feedzai.com)
 * @author Henrique Dias (henrique.dias@feedzai.com)
 */

/**
 * Clones the given `repo` using git into the tmp folder.
 *
 * @param {Object} repo
 */
async function cloneRepo(repo) {
    const repoUrl = repo.gitRepoUrl;

    const branch = repo.targetBranch;

    const repoFolder = getRepoFolder(repo);

    const folderExists = await fileExists(repoFolder);

    if (!fs.existsSync("./tmp")) {
        fs.mkdirSync("./tmp");
    }

    let command;

    if (folderExists) {
        command = `cd ${repoFolder} && git checkout -f && git checkout ${branch} && git pull --rebase`;
    } else {
        command = `cd tmp && git clone ${repoUrl} --branch ${branch}`;
    }

    const { stdout, stderr } = await exec(command);

    // TODO improve logger output
    if (stdout) {
        logger.info(`${repo.label} cloned successfully`);
    } else if (stderr) {
        logger.error(`error cloning ${repo.label}`);
    }
}

/**
 * Calculates all the metrics for the given `repo`
 *
 * @param {Object} repo
 * @returns {Object}
 */

async function installRepo(repo) {
    const folder = getRepoFolder(repo);
    let result;

    if (hasYarn(folder)) {
        result = await executeCommand(folder, "yarn  install");
    } else {
        result = await executeCommand(folder, "npm install");
    }

    if (!result) {
        logger.error(`Error installing ${repo.label} or already installed`);
        return null;
    }
    logger.info(`${repo.label} installed successfully`);
    return true;
}

/**
 * Install the given `repo`
 * @param  {object} repo
 * @param {string} folder name
 */
async function installRepoSync(repo, folder) {
    let result;

    if (hasYarn(folder)) {
        result = await executeCommandSync(folder, "rm -rf node_modules && yarn  install");
    } else {
        result = executeCommandSync(folder, "npm install");
    }

    if (!result) {
        logger.error(`Error installing ${repo.label} or already installed`);
        return null;
    }
    logger.info(`${repo.label} installed successfully`);
    return true;
}

/**
 * Returns the repository name
 * @param {string} location
 * @returns {string}
 */
function getRepoName(location) {
    return executeCommandGetOutput(location, "git config --get remote.origin.url").then((name) => {
        return _.upperFirst(_.last(name.split("/")).replace(".git", "")).replace("\n", "");
    });
}

module.exports = {
    cloneRepo,
    installRepo,
    installRepoSync,
    getRepoName
};
