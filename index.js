const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");

const parseFlake8Output = require("./parser");

const { GITHUB_TOKEN } = process.env;

async function installFlake8() {
  await exec.exec("pip install flake8");
}

async function runFlake8() {
  let output = "";
  let options = {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
    },
  };
  await exec.exec("flake8 --exit-zero", [], options);
  return output;
}

async function createCheck(check_name, title, annotations) {
  const output = {
    title,
    summary: `${annotations.length} errors(s) found`,
    annotations,
  };

  const octokit = github.getOctokit(String(GITHUB_TOKEN));

  console.log("listForRef", github.context.sha);
  const res = await octokit.checks.listForRef({
    check_name,
    ref: github.context.sha,
    ...github.context.repo,
  });

  if (res.data.check_runs.length === 0) {
    console.log("create check");
    await octokit.checks.create({
      ...github.context.repo,
      name: check_name,
      head_sha: github.context.sha,
      output,
    });
  } else {
    console.log("update check");
    const check_run_id = res.data.check_runs[0].id;
    await octokit.checks.update({
      ...github.context.repo,
      check_run_id,
      output,
    });
  }
}

async function run() {
  try {
    await installFlake8();
    const output = await runFlake8();
    const annotations = parseFlake8Output(output);

    if (annotations.length) {
      console.log(annotations);
      const checkName = core.getInput("checkName");
      await createCheck(checkName, "flake8 failure", annotations);
      core.setFailed(annotations);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
