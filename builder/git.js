import * as util from 'util';
import { exec } from 'child_process';

const $exec = util.promisify(exec);

import { workingDirectory } from './pull.js';

/**
 * 
 * @param {string} path 
 * @returns {Promise<string[]>}
 */
export async function hasModifiedPackageFiles(path) {
    const cwd = `${process.env.GITHUB_WORKSPACE || '.'}/_working/${path}`;

    const { stdout, stderr } = await $exec(`git status -s`, { cwd });

    if (stderr) {
        console.log(stderr);

        throw new Error(`"git status" emitted errors.`);
    }

    if (stdout) {
        const modified_files = stdout.split('\n');

        const modified_paths = modified_files.map(f => f.split(' ').filter(s => s != '')[1] ?? '').filter(s => s != '');

        const modifiedPackages = new Set(modified_paths.filter(path => {
            return path.includes('index.d.ts') || path.includes('doc.json') || path.includes('LICENSE') || path.includes('README.md');
        }).map(packagePath => {
            const [, pkg] = packagePath.match(/packages\/@gi-types\/(.*)\/.*/);

            console.log(pkg);

            return pkg;
        }));

        return [...modifiedPackages.values()];
    }

    throw new Error(`"git status" gave no output...`);
}

/** @type {string | null} */
let __formattedDate = null;

/**
 * @returns {string}
 */
export function getFormattedDate() {
    if (__formattedDate) return __formattedDate;

    const date = new Date();

    const formatter = new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        year: 'numeric',
        month: '2-digit'
    });

    const formattedDateParts = formatter.formatToParts(date);
    const month = formattedDateParts.find(p => p.type === "month")?.value;
    const day = formattedDateParts.find(p => p.type === "day")?.value;
    const year = formattedDateParts.find(p => p.type === "year")?.value;

    if (month == null || day == null || year == null) {
        throw new Error(`Unable to construct date formatting...`);
    }

    let formattedDate = `${year}-${month}-${day}`;
    __formattedDate = formattedDate;

    return formattedDate;
}

export async function commitChangesFiles(path) {
    const cwd = workingDirectory(path);

    // Set up correct committer.
    await $exec(`git config user.email ${process.env.GIT_EMAIL}`, { cwd });
    await $exec(`git config user.name ${process.env.GIT_USERNAME}`, { cwd });

    let { stdout, stderr } = await $exec(`git add -v packages/@gi-types/**/*`, { cwd });

    const formattedDate = getFormattedDate();

    ({ stdout, stderr } = await $exec(`git commit -m "Update ${formattedDate}."`, { cwd }));

    if (stderr) console.log(stderr);
    if (stdout) console.log(stdout);

    ({ stdout, stderr } = await $exec(`git push -f -u origin auto-updates/${formattedDate}`, { cwd }));

    if (stderr) console.log(stderr);
    if (stdout) console.log(stdout);

    ({ stdout, stderr } = await $exec(`gh pr create --title "Update ${formattedDate} for Types." --body "Type packages have been updated."`, { cwd }));

    if (stderr) console.log(stderr);
    if (stdout) console.log(stdout);
}


