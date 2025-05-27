/**
 * Utility export functions for the Team Approval Checker GitHub App.
 *
 * These export functions help determine if reviewers are part of a specific team,
 * count the number of valid approvals from team members, and check if the
 * required number of approvals has been met.
 */

/**
 * Checks if a given reviewer is a member of the specified team.
 *
 * @param {string} reviewer - The GitHub username of the reviewer.
 * @param {string[]} teamMembers - Array of GitHub usernames who are members of the team.
 * @returns {boolean} True if the reviewer is in the team, false otherwise.
 */
export function isReviewerInTeam(reviewer, teamMembers) {
    return teamMembers.includes(reviewer);
}

/**
 * Counts the number of approvals on a pull request from team members.
 *
 * @param {Object[]} reviews - Array of review objects from the GitHub API.
 * @param {string[]} teamMembers - Array of GitHub usernames who are members of the team.
 * @returns {number} The count of unique team member approvals.
 */
export function countApprovals(reviews, teamMembers) {
    return reviews.filter(review => 
        review.state === 'APPROVED' && 
        isReviewerInTeam(review.user.login, teamMembers)
    ).length;
}

/**
 * Checks if the actual number of approvals meets or exceeds the required number.
 *
 * @param {number} requiredApprovals - The minimum number of approvals required.
 * @param {number} actualApprovals - The actual number of approvals received.
 * @returns {boolean} True if the requirement is met, false otherwise.
 */
export function checkApprovalStatus(requiredApprovals, actualApprovals) {
    return actualApprovals >= requiredApprovals;
}

/**
 * Fetches all reviews for a pull request.
 * @param {object} github - The Octokit GitHub client.
 * @param {object} context - The GitHub Actions context object.
 * @param {number} prNumber - The pull request number.
 * @returns {Promise<Array>} Array of review objects.
 */
export async function getPullRequestReviews(github, owner, repo_name, prNumber) {
    console.log(`Fetching reviews for PR #${prNumber}\n\n\n\n`);
    // Fetch all reviews for the pull request
    const { data } = await github.rest.pulls.listReviews({
        owner: owner,
        repo: repo_name,
        pull_number: prNumber,
    });
    return data;
}

/**
 * Fetches all members of a specified team.
 * @param {object} github - The Octokit GitHub client.
 * @param {object} context - The GitHub Actions context object.
 * @param {string} teamName - The name of the team.
 * @returns {Promise<Array>} Array of usernames.
 */
export async function getTeamMembers(github, org, teamName) {
    console.log(`Fetching members of team: ${teamName} in org: ${org}`);
    const { data } = await github.rest.teams.listMembersInOrg({
        org: org,
        team_slug: teamName,
    });
    return data.map(member => member.login);
}

/**
 * Returns the number of unique team members who have approved the PR.
 * @param {Array} reviews - Array of review objects from the GitHub API.
 * @param {Array} teamMembers - Array of GitHub usernames who are members of the team.
 * @returns {number} The count of unique team member approvals.
 */
export function checkApprovals(reviews, teamMembers) {
    // Map to store the latest review state for each user
    const latestReviewByUser = new Map();
    for (const review of reviews) {
        if (teamMembers.includes(review.user.login)) {
            latestReviewByUser.set(review.user.login, review.state);
        }
    }
    // Count unique team members whose latest review is APPROVED
    let count = 0;
    for (const state of latestReviewByUser.values()) {
        if (state === 'APPROVED') count++;
    }
    return count;
}

// Helper to read file content from a repo
export async function readFileFromAdminRepo(github, owner, repo, path, ref = 'main') {
  const { data } = await github.rest.repos.getContent({
    owner,
    repo,
    path,
    ref, // branch or commit SHA
  });

  // If the file is text-based, decode from base64
  if (data && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf8');
  }
  throw new Error('File not found or not readable');
}