const github = require('@actions/github')
const core = require('@actions/core')
const YAML = require('yaml')
const fs = require('fs').promises

const context = github.context

const token = core.getInput('token')
const octokit = github.getOctokit(token)

const duplicateLabel = core.getInput('duplicateLabel')
const triageLabel = core.getInput('triageLabel')
const staleLabel = core.getInput('staleLabel')
const triagedLabels = core.getInput('triagedLabels').split('\n')
const sponsorsFile = core.getInput('sponsorsFile')

const duplicateRegexp = /duplicate(?:d| of)? #(\d+)/gi

;(async function run() {
  const labelsToAdd = new Set()
  const labelsToRemove = new Set()

  const issueLabels = context.payload.issue.labels.map(v => v.name)
  if (!issueLabels.some(v => triagedLabels.includes(v))) {
    labelsToAdd.add(triageLabel)
  } else {
    labelsToRemove.add(triageLabel)
    staleLabel && labelsToRemove.add(staleLabel)
  }

  if (context.payload.action === 'closed') {
    let hasDuplicateComment
    if (context.payload.issue.state_reason === 'not_planned' && context.payload.issue.comments) {
      const comments = await octokit.rest.issues.listComments({
        ...context.repo,
        issue_number: context.payload.issue.number,
      }).then(r => r.data)
      hasDuplicateComment = duplicateRegexp.test(comments.at(-1)?.body)
    }
    if (hasDuplicateComment || context.payload.issue.state_reason === 'duplicate') {
      labelsToAdd.add(duplicateLabel)
      labelsToRemove.add(triageLabel)
      staleLabel && labelsToRemove.add(staleLabel)
    }
  }

  const sponsors = YAML.parse(await fs.readFile(sponsorsFile, 'utf8'))
  const issueAuthor = context.payload.issue.user.login
  for (const { label, members } of sponsors) {
    if (members && ~members.findIndex(v => v.toLowerCase() === issueAuthor.toLowerCase())) {
      labelsToAdd.add(label)
      break
    }
  }

  if (labelsToAdd.size) {
    await octokit.rest.issues.addLabels({
      ...context.repo,
      issue_number: context.payload.issue.number,
      labels: [...labelsToAdd],
    })
  }
  for (const label of labelsToRemove) {
    await octokit.rest.issues.removeLabel({
      ...context.repo,
      issue_number: context.payload.issue.number,
      name: label,
    })
  }
})()
