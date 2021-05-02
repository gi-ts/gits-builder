import * as util from 'util';
import { exec } from 'child_process';
import { rm, mkdir } from 'fs/promises';
import { getFormattedDate } from './git.js';

const $exec = util.promisify(exec);

const MUTTER_VERSION = '8';

/**
 * @param {string} path
 */
export function workingDirectory(path) {
    return `${process.env.GITHUB_WORKSPACE || '.'}/_working/${path}`;
}

export async function cloneRepo(path) {
    console.log("Removing any previous clones...");

    let cwd = workingDirectory(path);

    await rm(cwd, { recursive: true });

    await mkdir(cwd, { recursive: true });

    let { stdout, stderr } = await $exec(`gh repo clone ${path} ${cwd}`);

    if (stderr) {
        console.log(`stderr: ${stderr}`);
    }
    if (stdout) {
        console.log(`stdout: ${stdout}`);
    }

    const formattedDate = getFormattedDate();


    ({ stdout, stderr } = await $exec(`git checkout -b auto-updates/${formattedDate}`, { cwd }));

    if (stderr) console.log(stderr);
    if (stdout) console.log(stdout);
}

export async function installDependencies(path) {
    const cwd = workingDirectory(path);

    const { stdout, stderr } = await $exec('yarn install', { cwd });

    if (stderr) {
        console.log(`stderr: ${stderr}`);
    }
    if (stdout) {
        console.log(`stdout: ${stdout}`);
    }
}

export async function buildTypes(path) {
    const cwd = workingDirectory(path);

    const { stdout, stderr } = await $exec('yarn generate', {
        cwd,
        env: {
            ...process.env,
            XDG_DATA_DIRS: [
                "/usr/share/",
                "/usr/share/gnome-shell/",
                `/usr/lib/mutter-${MUTTER_VERSION}/`
            ].join(":")
        }
    });

    if (stderr) {
        console.log(`stderr: ${stderr}`);
    }
    if (stdout) {
        console.log(`stdout: ${stdout}`);
    }
}

