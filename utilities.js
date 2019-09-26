const exec = require("child_process").exec;
const execSync = require("child_process").execSync;
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const util = require("util");
const _ = require("lodash");
const fileExists = require("@feedzai/fdz-js-utils/src/fileSystem/fileExists");
const he = require("he");
const stripJsonComments = require("strip-json-comments");
const readFile = util.promisify(fs.readFile);
const logger = require("pino")({

    prettyPrint: { colorize: true },
    translateTime: false
});
const configs = require("./configs");
const stat = util.promisify(fs.stat);


/**
 * utils
 *
 * Used to store all non-related methods used through the project.
 *
 * @author Luis Cardoso (luis.cardoso@feedzai.com)
 * @author Henrique Dias (henrique.dias@feedzai.com)
 */



async function fileExists() {
    try {
        const args = Array.prototype.slice.call(arguments);

        const pathToCheck = args.reduce((memo, segment) => {
            return path.join(memo, segment);
        }, "");

        await stat(pathToCheck);

        return true;
    } catch (e) {
        return false;
    }
}
const TMP_DIR = "./tmp";

const METRIC_GROUPS = {
    RANDOM: "Random",
    VERSIONS: "Versions",
    COMMANDS: "Commands",
    HAS: "Has"

};

module.exports.TMP_DIR = TMP_DIR;

/**
 * Loads jest config file for a given `repoFolder`
 * @param  {string} repoFolder
 * @returns {string}
 */
async function loadJestConfig(repoFolder) {
    let rawTextFile;

    try {
        rawTextFile = await readFile(path.join(repoFolder, "jest.config.js"), "utf8");
    } catch (err) {
        logger.error("error openning file");
        return null;
    }

    return rawTextFile;
}

/**
 * Checks whether a repository is installed or not
 * @param  {string} repoFolder
 * @returns {boolean}
 */
function isInstalled(repoFolder) {
    const r = `${repoFolder}/node_modules`;

    if (fs.existsSync(r)) {
        return true;
    }
    return false;
}

/**
 * Loads Eslint config for a given `repoFolder`
 * @param  {string} repoFolder
 */
async function loadEslintFile(repoFolder) {
    let eslintRc;

    if (await fileExists(repoFolder, ".eslintrc.json")) {
        const rawTextFile = await readFile(path.join(repoFolder, ".eslintrc.json"), "utf8");

        eslintRc = JSON.parse(stripJsonComments(rawTextFile));
    } else if (await fileExists(repoFolder, ".eslintrc")) {
        const rawTextFile = await readFile(path.join(repoFolder, ".eslintrc"), "utf8");

        try {
            eslintRc = JSON.parse(stripJsonComments(rawTextFile));
        } catch (error) {
            eslintRc = null;
        }
    } else {
        eslintRc = {};
    }
    return eslintRc;
}

/**
 * Gets the SHA1 checksum for the package.json in the `repoFolder`
 * @param  {string} repoFolder
 * @returns {string}
 */
function getPackageChecksum(repoFolder) {
    try {
        const file = fs.readFileSync(path.resolve(repoFolder, `package.json`));

        const shasum = crypto.createHash("sha1");

        shasum.update(file);

        return shasum.digest("hex");
    } catch (err) {
        logger.error("Error calculating checksum");
        return 0;
    }
}

/**
 * Returns all Dependencies for a given `packageJson`
 * @param  {object} packageJson
 * @returns {Array}
 */
function getAllDependencies(packageJson) {
    return Object.assign({}, packageJson.devDependencies, packageJson.dependencies);
}

/**
 * Executes the given `command` on the given `folder`
 * @param  {string} folder
 * @param  {string} command
 * @returns {boolean}
 */
function executeCommand(folder, command) {
    const com = `cd ${folder} &&  ${command} `;

    return new Promise((resolve) => {
        // eslint-disable-next-line no-unused-vars
        exec(com, { maxBuffer: 1024 * 1024 * 100 }, function (err, stdout, stderr) {
            if (err) {
                console.log(err);
                resolve(false);
            }
            resolve(true);
        });
    });
}

/**
 * Executes a `command` in a `folder`
 * @param  {string} folder
 * @param  {string} command
 * @returns {string}
 */
function executeCommandSync(folder, command) {
    try {
        return execSync(`cd ${folder} && ${command}`);
    } catch (err) {
        console.log(err);
        logger.error(`Error executing ${command} on ${folder}`);
    }
}

/**
 * As the name implies, this method will execute a `command` on 
 * a `folder` and return its output
 * @param  {string} folder
 * @param  {string} command
 * @returns {Promise<string>}
 */
function executeCommandGetOutput(folder, command) {
    const com = `cd ${folder} &&  ${command} `;

    return new Promise((resolve, reject) => {
        // eslint-disable-next-line no-unused-vars
        exec(com, { maxBuffer: Infinity }, function (err, stdout, stderr) {
            if (!_.isNull(err)) {
                reject(null);
            }
            resolve(stdout);
        });
    });
}

/**
 * Reads `file` from `repoFolder`
 * @param  {string} repoFolder
 * @param  {string} file
 * @returns {string}
 */
function getFileFolder(repoFolder, file) {
    return new Promise((resolve) => {
        fs.readFile(path.join(repoFolder, file), "utf8", (err, data) => {
            resolve(data);
        });
    });
}

/**
 * Open a file with the fiven full path (including filename)
 * @param  {string} completePath
 * @returns {Promise<string>}
 */
function openFileFromPath(completePath) {
    return new Promise((resolve) => {
        fs.readFile(completePath, "utf8", (err, data) => {
            resolve(data);
        });
    });
}


/**
 * Gets last commit hash for a given repo
 * @param  {string} repoFolder
 * @returns {string}
 */
function getLastCommitHash(repoFolder) {
    let result = executeCommandSync(repoFolder, "git rev-parse HEAD").toString();
    result.replace("\n", "");
    return result;
}


/**
 * Returns the repository folder name (e.g., `kit`).
 *
 * @param {Object} repo
 * @returns {string}
 */
function getRepoFolderName(repo) {
    return "";
    return _.last(repo.gitRepoUrl.split("/")).replace(".git", "");
}

/**
 * Loads the last report from his config file
 * @returns {object | null}
 */
function loadLastReport() {
    return openFileFromPath(configs.getJsonReporter()["output-file"]).then((file) => {
        try {
            return JSON.parse(file);
        } catch (e) {
            return null;
        }
    });
}

/**
 * Returns the repository folder path to run the analysis on (e.g., `./tmp/genome/genome-ui/src/main/webapp`).
 *
 * @param {Object} repo
 * @returns {string}
 */
function getRepoFolder(repo) {
    if (_.isBoolean(repo.isLocal)) {
        return process.cwd();
    }

    let folder = path.join(__dirname, "../tmp");

    return folder;
}

/**
 * Checks out a git repository in `repoFolder` to a git `hash`
 * @param  {string} repoFolder
 * @param  {string} hash
 */
async function checkoutToCommit(repoFolder, hash) {
    return executeCommandSync(repoFolder, `git checkout -f && git checkout ${hash}`);
}

/**
 * Returns all the commits for a given folder
 * @param  {string} repoFolder
 * @returns {Array}
 */
async function getAllCommits(repoFolder) {
    return executeCommandGetOutput(repoFolder, "git log --decorate --pretty=oneline ").then((res, err) => {
        let lines = [];

        lines = res.split("\n");
        let hashes = [];

        for (let i = 0; i < lines.length; i++) {
            if (lines[i] !== "") {
                hashes.push(lines[i].split(" ")[0]);
            }
        }

        return hashes;
    });
}


/**
 * Returns the date for a given repo in `repoFolder` with the following`commit`
 * @param  {string} repoFolder
 * @param  {string} commit
 * @returns {Date}
 */
function getDateForCommit(repoFolder, commit) {

    if (!_.isString(commit)) {
        return null;
    }
    const out = executeCommandSync(repoFolder, `git show -s --format=%ci ${commit} `);

    return new Date(out);
}


module.exports.getRepoFolder = getRepoFolder;

module.exports.fileExists = fileExists;

module.exports.executeCommand = executeCommand;

module.exports.getFileFolder = getFileFolder;

module.exports.isInstalled = isInstalled;

module.exports.METRIC_GROUPS = METRIC_GROUPS;

module.exports.getAllDependencies = getAllDependencies;

module.exports.loadEslintFile = loadEslintFile;

module.exports.loadJestConfig = loadJestConfig;

module.exports.openFileFromPath = openFileFromPath;

module.exports.executeCommandGetOutput = executeCommandGetOutput;

module.exports.getLastCommitHash = getLastCommitHash;

module.exports.loadLastReport = loadLastReport;

module.exports.getAllCommits = getAllCommits;

module.exports.checkoutToCommit = checkoutToCommit;

module.exports.getDateForCommit = getDateForCommit;

module.exports.executeCommandSync = executeCommandSync;

module.exports.getPackageChecksum = getPackageChecksum;

module.exports.fileExists = fileExists;