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

    // app.log.info(`Pull request review event payload: ${JSON.stringify(context.payload)}`);

    if (!pull_request) {
      app.log.info('No pull request found in event payload.');
      return;
    }

    // You can set these via environment variables or a config file
    const owner = process.env.ADMIN_REPO_ORG
    const repo = process.env.ADMIN_REPO_NAME
    const path = process.env.ADMIN_REPO_PATH
    const ref = process.env.ADMIN_REPO_REF || 'main';

    let teamName
    let requiredApprovals
    // Read the YAML file from the admin repo
    app.log.info(`Reading file from admin repo: ${owner}/${repo}/${path}`);
    const approval_rules_yaml = await readFileFromAdminRepo(context.octokit, owner, repo, path, ref)
    app.log.debug(`Read file content: ${approval_rules_yaml}`);

    // Parse the YAML content to get the team name and required approvals for the PR Repo

    try {
      const approvalRules = yaml.load(approval_rules_yaml);

      // Find the rule that matches the repo and branch
      const repoName = pull_request.base.repo.name;
      const branchName = pull_request.base.ref;

      const rule = approvalRules.repos.find(
        r => r.repo_name === repoName && r.branch === branchName
      );

      app.log.info(`Approval rules for repo ${repoName} branch ${branchName}: ${JSON.stringify(rule)}`);

      if (rule) {
        teamName = rule.team;
        requiredApprovals = rule.required_approvals;
        app.log.info(`Approval rules for ${repoName}/${branchName}: team=${teamName}, required_approvals=${requiredApprovals}`);
      } else {
        app.log.info(`No approval rules found for ${repoName}/${branchName}`);
      }
    } catch (err) {
      app.log.error(`Failed to parse approval rules YAML: ${err.message}`);
    }

    // Fetch all reviews for the pull request
    const reviews = await getPullRequestReviews(context.octokit, pull_request.base.repo.owner.login, pull_request.base.repo.name, pull_request.number);
    app.log.info(`Fetched ${reviews.length} reviews for PR #${pull_request.number}`);


    // // Fetch all members of the specified team
    const teamMembers = await getTeamMembers(context.octokit, organization.login, teamName);
    app.log.info(`Fetched ${teamMembers.length} members for team ${teamName}`);
    // Count the number of unique team members who have approved the PR
    const approvalCount = checkApprovals(reviews, teamMembers);
    app.log.info(`Approval count from team ${teamName}: ${approvalCount}`);

    // Log result and optionally update PR status
    if (approvalCount >= requiredApprovals) {
      app.log.info(`Success: ${approvalCount} approvals from team ${teamName} met the requirement.`);
      // Optionally, you can set a status or comment on the PR here
    } else {
      app.log.info(`Failed: Only ${approvalCount} approvals from team ${teamName} received.`);
      // Optionally, you can set a status or comment on the PR here
    }
  });
};