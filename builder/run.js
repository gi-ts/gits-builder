import { readFile } from 'fs/promises';

import { cloneRepo, installDependencies, buildTypes } from './pull.js';
import { buildPackages } from './buildPackages.js';
import { commitChangesFiles, hasModifiedPackageFiles } from './git.js';

const { repos } = JSON.parse(await readFile('./repos.json', { encoding: 'utf-8' }));
/** @type {{tag:string; path: string; name: string; }[]} */
const paths = repos.map(repo => ({ name: repo.name, tag: repo.tag ?? 'latest', path: `gi-ts/${repo.name}` }));

const selectedName = process.argv[2];

for (const { path, tag, name } of paths) {
    if (selectedName && name !== selectedName) {
        console.log(`Skipping ${path}...`);
        continue;
    } else {
        console.log(`Updating packages for: ${path}`);
    }

    try {
        await cloneRepo(path);

        let dependenciesInstallFailed = false;
        try {
            await installDependencies(path);
        } catch (err) {
            console.log("Failed to install dependencies...");
            console.log(err.message);

            dependenciesInstallFailed = true;
        }

        await buildTypes(path);

        const modifiedPackages = await hasModifiedPackageFiles(path);

        await buildPackages(path, tag, modifiedPackages);

        if (dependenciesInstallFailed) {
            console.log("Retrying dependency install...");
            await installDependencies(path);
        }

        await commitChangesFiles(path);

        console.log(`Updated packages for: ${path}`);
    } catch (error) {
        console.log(error.message);

        console.log(`Failed to update packages for: ${path}`);
    }
}
