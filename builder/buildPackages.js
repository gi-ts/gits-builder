import * as fs from 'fs/promises';

import semver from 'semver';
import NpmApi from 'npm-api';

import { LICENSE } from './license.js';
import { createREADME } from './readme.js';

const versionMap = new Map();

async function latestVersion(name, majorVersion, tag) {
    const versions = versionMap.get(name);

    if (!versions) {
        console.error(`No versions for ${name}`);

        const pkg = await getCurrentPackage(`${prefix}/${name.toLowerCase()}`, tag);

        if (pkg) {
            return pkg.version;
        }

        return null;
    }

    return versions[majorVersion];
}

function packageVersion(meta, revision) {
    const rawVersion = meta.package_version || meta.api_version;
    const sem = semver.parse(rawVersion) || semver.coerce(rawVersion);

    if (!sem) {
        throw new Error(`Invalid raw version: ${rawVersion} for ${meta.name}`);
    }

    sem.patch = revision;

    // TODO(ewlsh): Handle pre-releases with the alpha/beta/rc scheme.
    // if (sem.minor >= 90) {
    //     return `${sem.format()}-prerelease`;
    // }

    return `${sem.format()}`;
}

const prefix = '@gi-types';


const npm = new NpmApi();

async function getCurrentPackage(name, tag) {
    let repo = npm.repo(name);

    if (repo) {
        try {
            let pkg = await repo.version(tag);

            return pkg;
        } catch (err) {
            console.log(err)
        }
    }
    return null;
}

/** 
 * @typedef PackageType
 * @property {string} path
 * @property {boolean} isPrivate
 * @property {string} directory
 * @property {string} package
 * @property {string} gitHead
 * @property {string} version
 * @property {{name: string; api_version: string; package_version: string;}} meta
 */

/**
 * @param {*} meta 
 * @param {string} version 
 * @param {string} gitHead
 * @param {string} tag 
 * @param {boolean} [hasOverride]
 * @param {boolean} [isPrivate] 
 * @param {boolean} [downgrade]
 */
async function buildPackageJSON(path, meta, version, gitHead, tag, hasOverride = false, isPrivate = false, downgrade = false) {
    const pkg = await getCurrentPackage(`${prefix}/${meta.name.toLowerCase()}`, tag);

    if (pkg !== null) {
        version = pkg.version;
    }

    const [dependencies, peerDependencies] = (await Promise.all(Object.entries(meta.imports).map(async ([im, api_version]) => {
        const version = await latestVersion(im, api_version, tag);

        if (version)
            return [`${prefix}/${im.toLowerCase()}`, `^${version}`];
        else
            return [`${prefix}/${im.toLowerCase()}`, `*`];
    }))).reduce(([dependencies, peerDependencies], [a, b]) => {
        if (b === '*') {
            peerDependencies.push([a, b])
        } else {
            dependencies.push([a, b])
        }

        return [dependencies, peerDependencies];
    }, [[], []]).map(list => list.length > 0 ? Object.fromEntries(list.sort(([a], [b]) => a.localeCompare(b))) : null);

    if (peerDependencies && Object.keys(peerDependencies).length > 0) {
        throw new Error(`${meta.name} has missing dependencies: ${Object.keys(peerDependencies).join(',')}.`);
    }

    return {
        "name": `${prefix}/${meta.name.toLowerCase()}`,
        ...(isPrivate ? { "private": true } : {
            "publishConfig": {
                "access": "public",
                "tag": tag
            }
        }),
        "version": `${version}`,
        "description": `TypeScript definitions for ${meta.name}`,
        "license": "MIT",
        "contributors": [
            {
                "name": "Evan Welsh",
                "url": "https://github.com/ewlsh/",
                "githubUsername": "ewlsh"
            }
        ],
        "main": "",
        "files": [
            "index.d.ts",
            "doc.json",
            "package.json",
            "README.md",
            "LICENSE"
        ],
        "types": "index.d.ts",
        "repository": {
            "type": "git",
            "url": `https://github.com/${path}`,
            "directory": `packages/@gi-types/${meta.slug}`
        },
        "scripts": {},
        ...(dependencies ? {
            "dependencies":
            {
                ...dependencies
            }
        } : {}),
        ...(peerDependencies ? {
            "peerDependencies":
            {
                ...peerDependencies
            }
        } : {}),
        "typeScriptVersion": "4.1",
        "gitHead": gitHead
    };
}

/**
 * @param {string} dir 
 */
async function getDirectories(dir) {
    return (await fs.readdir(dir, {
        withFileTypes: true
    }))
        .filter(child => child.isDirectory())
        .map(child => child.name);
}

/**
 * @param {string} directory 
 * @param {string[] | null} [includeList] 
 * @returns {Promise<PackageType[]>}
 */
async function generatePackages(directory, includeList = null) {
    console.log(`Generating packages for ${directory}.`);

    const packages = await getDirectories(directory);

    return Promise.all(
        packages.map(async packageName => {
            const meta = JSON.parse(await fs.readFile(`${directory}/${packageName}/doc.json`, {
                encoding: 'utf-8'
            }));

            let currentPackageVersion = null;
            let gitHead = null;

            let version = packageVersion(meta, 0);

            try {
                let packagejson = JSON.parse(await fs.readFile(`${directory}/${packageName}/package.json`, {
                    encoding: 'utf-8'
                }));


                currentPackageVersion = packagejson["version"];
                gitHead = packagejson["gitHead"];

                if (currentPackageVersion) {
                    const sem = semver.parse(currentPackageVersion);
                    version = packageVersion(meta, sem.patch + 1);
                }
            } catch (err) { }

            meta.slug = packageName;

            const shouldBeGenerated = includeList && !includeList.includes(meta.name);

            if (shouldBeGenerated) {
                const versions = versionMap.get(meta.name) || {};

                versions[meta.api_version] = version;

                versionMap.set(meta.name, versions);
            }

            return { path: `gi-ts/${directory}`, isPrivate: !shouldBeGenerated, directory, package: packageName, gitHead, version, meta };
        })
    );
}

/**
 * @param {PackageType[]} packages 
 * @param {string} tag 
 */
function printPackages(packages, tag) {
    return Promise.all(packages.map(async ({ path, isPrivate, directory, package: packageName, gitHead, version, meta }) => {
        if (!isPrivate) {
            const json = await buildPackageJSON(
                path,
                meta,
                version,
                gitHead,
                tag,
                isPrivate,
            );

            const README = createREADME(meta.name, meta.api_version, meta.package_version);

            fs.writeFile(`${directory}/${packageName}/package.json`, `${JSON.stringify(json, null, 4)}\n`);

            fs.writeFile(`${directory}/${packageName}/LICENSE`, `${LICENSE}`);
            fs.writeFile(`${directory}/${packageName}/README.md`, `${README}`);
        }
    }));
}

/**
 * @param {string} path
 * @param {string[]} packagesToUpdate
 */
export async function buildPackages(path, tag, packagesToUpdate) {
    const base = await generatePackages(`./_working/${path}/packages/${prefix}/`, packagesToUpdate);

    await printPackages(base, tag).then(() => {
        console.log(versionMap);
    });
}
