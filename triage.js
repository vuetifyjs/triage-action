const github = require('@actions/github')
const core = require('@actions/core')
const YAML = require('yaml')
const fs = require('fs').promises

const context = github.context

const token = core.getInput('token')
const octokit = github.getOctokit(token)

const triageLabel = core.getInput('triageLabel')
const triagedLabels = core.getInput('triagedLabels').split('\n')
const sponsorsFile = core.getInput('sponsorsFile')

;(async function run() {
  const labelsToAdd = []

  const issueLabels = context.payload.issue.labels.map(v => v.name)
  if (!issueLabels.some(v => triagedLabels.includes(v))) {
    labelsToAdd.push(triageLabel)
  }

  const sponsors = YAML.parse(await fs.readFile(sponsorsFile, 'utf8'))
  const issueAuthor = context.payload.issue.user.login
  for (const { label, members } of sponsors) {
    if (members && ~members.findIndex(v => v.toLowerCase() === issueAuthor.toLowerCase())) {
      labelsToAdd.push(label)
      break
    }
  }

  if (labelsToAdd.length) {
    await octokit.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
      labels: labelsToAdd
    })
  }
})()
