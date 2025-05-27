import { getPullRequestReviews, getTeamMembers, checkApprovals, readFileFromAdminRepo } from './utils.js';
import yaml from 'js-yaml';
import { registerApprovalRulesRoute } from './web.js';
import * as express from "express";

/**
 * Probot App: Team Approval Checker
 *
 * This app checks if a pull request (PR) has received a required number of approvals
 * from members of a specific GitHub team. It is triggered by PR review events.
 *
 * Environment Variables or App Config:
 * - TEAM_NAME: The name of the GitHub team whose approvals are required.
 * - REQUIRED_APPROVALS: The minimum number of team member approvals required.
 */
export default (app, { getRouter }) => {
  // Get an express router to expose new HTTP endpoints
  const router = getRouter("/app");
  router.use(express.json()); // <-- Add this line
  // Register the web route
  // registerApprovalRulesRoute(router);
  const installation_id = 67771903

  app.auth(installation_id).then(octokit => {
    registerApprovalRulesRoute(router, octokit);
  });
  router.use(express.static('public'));

  app.on('pull_request_review', async (context) => {
    app.log.info('Pull request review event received.');

    const { pull_request, organization } = context.payload;

    if (!pull_request) {
      app.log.info('No pull request found in event payload.');
      return;
    }

    // You can set these via environment variables or a config file
    const owner = process.env.ADMIN_REPO_ORG
    const repo = process.env.ADMIN_REPO_NAME
    const path = process.env.ADMIN_REPO_PATH
    const ref = process.env.ADMIN_REPO_REF || 'main';

    // Read the YAML file from the admin repo
    app.log.info(`Reading file from admin repo: ${owner}/${repo}/${path}`);
    const approval_rules_yaml = await readFileFromAdminRepo(context.octokit, owner, repo, path, ref)
    app.log.debug(`Read file content: ${approval_rules_yaml}`);

    try {
      const approvalRules = yaml.load(approval_rules_yaml);
      const repoName = pull_request.base.repo.name;
      const branchName = pull_request.base.ref;

      // Fetch all reviews for the pull request
      const reviews = await getPullRequestReviews(
        context.octokit,
        pull_request.base.repo.owner.login,
        pull_request.base.repo.name,
        pull_request.number
      );
      app.log.info(`Fetched ${reviews.length} reviews for PR #${pull_request.number}`);

      // Find all rules that match the repo and branch (supporting wildcards)
      function branchMatches(pattern, branch) {
        if (pattern === '*') return true;
        if (pattern.endsWith('/*')) {
          return branch.startsWith(pattern.slice(0, -2));
        }
        return pattern === branch;
      }

      function repoMatches(pattern, repo) {
        if (pattern === '*') return true;
        if (pattern.endsWith('/*')) {
          return repo.startsWith(pattern.slice(0, -2));
        }
        return pattern === repo;
      }

      const matchingRules = approvalRules.repos.filter(
        r => repoMatches(r.repo_name, repoName) && branchMatches(r.branch, branchName)
      );

      if (matchingRules.length === 0) {
        app.log.info(`No matching approval rules found for repo ${repoName} branch ${branchName}.`);

        // Set a successful check run if no rules match
        const checkParams = {
          owner: pull_request.base.repo.owner.login,
          repo: pull_request.base.repo.name,
          name: 'team-approval',
          head_sha: pull_request.head.sha,
          status: 'completed',
          conclusion: 'success',
          output: {
            title: 'No team approval rules apply',
            summary: 'No matching team approval rules were found for this repository and branch. Marking as passed.',
          },
        };
        await context.octokit.checks.create(checkParams);

        return;
      }

      app.log.info(`Processing ${matchingRules.length} matching approval rules for repo ${repoName} branch ${branchName}`);
      app.log.debug(`Matching rules: ${JSON.stringify(matchingRules)}`);

      let allRulesPassed = true;
      let failedMessages = [];

      for (const rule of matchingRules) {
        const teamName = rule.team;
        const requiredApprovals = rule.required_approvals;
        app.log.info(`Applying rule: team=${teamName}, required_approvals=${requiredApprovals}`);

        // Fetch all members of the specified team
        const teamMembers = await getTeamMembers(context.octokit, organization.login, teamName);
        app.log.info(`Fetched ${teamMembers.length} members for team ${teamName}`);

        // Count the number of unique team members who have approved the PR
        const approvalCount = checkApprovals(reviews, teamMembers);
        app.log.info(`Approval count from team ${teamName}: ${approvalCount}`);

        if (approvalCount >= requiredApprovals) {
          app.log.info(`Success: ${approvalCount} approvals from team ${teamName} met the requirement.`);
        } else {
          app.log.info(`Failed: Only ${approvalCount} approvals from team ${teamName} received.`);
          allRulesPassed = false;
          failedMessages.push(
            `Team **${teamName}**: required ${requiredApprovals}, got ${approvalCount}`
          );
        }
      }

      // Set a check run on the PR
      const checkParams = {
        owner: pull_request.base.repo.owner.login,
        repo: pull_request.base.repo.name,
        name: 'team-approval',
        head_sha: pull_request.head.sha,
        status: 'completed',
        conclusion: allRulesPassed ? 'success' : 'failure',
        output: {
          title: allRulesPassed
            ? 'Team approval requirements met'
            : 'Team approval requirements not met',
          summary: allRulesPassed
            ? 'All required team approvals have been received.'
            : `Some team approval requirements are missing:\n${failedMessages.join('\n')}`,
        },
      };
      await context.octokit.checks.create(checkParams);

    } catch (err) {
      app.log.error(`Failed to parse approval rules YAML: ${err.message}`);
    }
  });
};