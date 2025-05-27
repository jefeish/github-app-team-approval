import yaml from 'js-yaml';
import octicons from '@primer/octicons';
import { readFileFromAdminRepo } from './utils.js';
/**
 * This page displays a sortable, table of repository approval rules fetched 
 * from a YAML file in your admin GitHub repo, as defined in the environment 
 * variables ADMIN_REPO_ORG, ADMIN_REPO_NAME, ADMIN_REPO_PATH.
 * @param {*} router
 * @param {*} octokit
 */
export function registerApprovalRulesRoute(router, octokit) {

  router.post('/approval-rules', async (req, res) => {
    console.log('Received request to update approval rules.');
    try {
      const { repos } = req.body;
      const yamlStr = yaml.dump({ repos });
      const owner = process.env.ADMIN_REPO_ORG;
      const repo = process.env.ADMIN_REPO_NAME;
      const path = process.env.ADMIN_REPO_PATH;
      const baseBranch = process.env.ADMIN_REPO_REF || 'main';
      const create_pr = process.env.ADMIN_REPO_CREATE_PR || FALSE;

      if (create_pr) {
        // --- Create new branch and PR ---
        // 1. Get latest commit SHA of base branch
        const { data: baseRefData } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${baseBranch}`,
        });
        const baseSha = baseRefData.object.sha;
  
        // 2. Create a unique branch name
        const branchName = `approval-rules-update-${Date.now()}`;
  
        // 3. Create the new branch
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        });
  
        // 4. Get the current file SHA from the new branch
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branchName,
        });
        const fileSha = fileData.sha;
  
        // 5. Commit the new YAML content to the new branch
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message: 'Update approval rules via web UI',
          content: Buffer.from(yamlStr, 'utf8').toString('base64'),
          sha: fileSha,
          branch: branchName,
        });
  
        // 6. Create a pull request
        const { data: pr } = await octokit.pulls.create({
          owner,
          repo,
          title: 'Update approval rules via web UI',
          head: branchName,
          base: baseBranch,
          body: 'This PR updates the approval rules table from the web UI.',
        });
  
        res.status(200).json({ pr_url: pr.html_url, message: 'Pull request created!' });
      } else {
        // --- Direct commit to main branch ---
        // Get the current file SHA (required for updating)
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: baseBranch,
        });
        const sha = fileData.sha;
  
        // Commit the new YAML content
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message: 'Update approval rules via web UI',
          content: Buffer.from(yamlStr, 'utf8').toString('base64'),
          sha,
          branch: baseBranch,
        });
  
        res.status(200).send('Saved');
      }
    } catch (err) {
      res.status(500).send(`Error saving approval rules: ${err.message}`);
    }
  });

  router.get('/approval-rules', async (req, res) => {
    try {
      // Set these via environment variables or config
      const owner = process.env.ADMIN_REPO_ORG;
      const repo = process.env.ADMIN_REPO_NAME;
      const path = process.env.ADMIN_REPO_PATH;
      const ref = process.env.ADMIN_REPO_REF || 'main';

      // Read YAML file from the admin repo
      const approval_rules_yaml = await readFileFromAdminRepo(octokit, owner, repo, path, ref);
      const approvalRules = yaml.load(approval_rules_yaml);

      // Octicon SVGs
      const logo = octicons['logo-github'].toSVG({ fill: "currentColor", width: 48, height: 48 });
      const repoIcon = octicons.repo.toSVG({ fill: "currentColor", width: 18, height: 18 });
      const branchIcon = octicons['git-branch'].toSVG({ fill: "currentColor", width: 18, height: 18 });
      const teamIcon = octicons.people.toSVG({ fill: "currentColor", width: 18, height: 18 });
      const approvalsIcon = octicons.check.toSVG({ fill: "currentColor", width: 18, height: 18 });
      const editIcon = octicons.pencil.toSVG({ fill: "currentColor", width: 16, height: 16 });
      const deleteIcon = octicons.trash.toSVG({ fill: "red", width: 16, height: 16 });
      const addIcon = octicons['plus-circle'].toSVG({ fill: "green", width: 16, height: 16 });

      let tableRows = '';
      for (const rule of approvalRules.repos) {
        tableRows += `
          <tr>
            <td>${rule.repo_name}</td>
            <td>${rule.branch}</td>
            <td>${rule.team}</td>
            <td>${rule.required_approvals}</td>
            <td>
              <span class="edit-row" style="cursor:pointer;" title="Edit">${editIcon}</span>
              <span class="delete-row ms-2" style="cursor:pointer;" title="Delete">${deleteIcon}</span>
            </td>
          </tr>
        `;
      }

      const html = `
        <html lang="en" data-bs-theme="dark">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Approval Rules</title>
            <link rel="icon" type="image/x-icon" href="/app/favicon.ico">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
              .table-no-borders th, .table-no-borders td {
                border: none !important;
              }
              .octicon {
                vertical-align: middle;
                margin-right: 6px;
              }
              .big-title {
                font-size: 2.8rem;
                font-weight: bold;
                letter-spacing: 1px;
                margin-bottom: 2.5rem;
                color: #fff;
                text-shadow: 0 2px 8px #222;
              }
              .custom-thead th {
                background: none !important;
                color: #0dcaf0;
                font-size: 1.2rem;
                font-weight: 600;
                border-bottom: 2px solid #0dcaf0 !important;
                text-shadow: 0 1px 4px #111;
                cursor: pointer;
                user-select: none;
              }
              .logo-github {
                position: absolute;
                top: 24px;
                left: 24px;
              }
              .sort-indicator {
                font-size: 1rem;
                margin-left: 4px;
              }
              .search-box {
                max-width: 320px;
                margin: 0 auto 2rem auto;
                display: block;
              }
            </style>
          </head>
          <body class="bg-dark text-light">
            <div class="logo-github">
              ${logo}
            </div>
            <div class="container py-5">
              <h2 class="text-center big-title">Approval Rules</h2>
              <input type="text" id="searchInput" class="form-control search-box" placeholder="Search table...">
              <div class="table-responsive">
                <table id="approval-table" class="table table-dark table-striped align-middle table-no-borders">
                  <thead class="custom-thead">
                    <tr>
                      <th data-col="0">${repoIcon}Repository<span class="sort-indicator"></span></th>
                      <th data-col="1">${branchIcon}Branch <span class="sort-indicator"></span></th>
                      <th data-col="2">${teamIcon}Team <span class="sort-indicator"></span></th>
                      <th data-col="3">${approvalsIcon}Required Approvals <span class="sort-indicator"></span></th>
                      <th id="addRow">${addIcon}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
                <br><br>
                <button id="saveTable" class="btn btn-success mb-3">Save Changes</button>
              </div>
            </div>
            <script>

              // Table search
              document.getElementById('searchInput').addEventListener('input', function() {
                const filter = this.value.toLowerCase();
                const rows = document.querySelectorAll('#approval-table tbody tr');
                rows.forEach(row => {
                  const text = row.textContent.toLowerCase();
                  row.style.display = text.includes(filter) ? '' : 'none';
                });
              });

              // Simple table sort
              document.querySelectorAll('.custom-thead th[data-col]').forEach(th => {
                th.addEventListener('click', function() {
                  const table = document.getElementById('approval-table');
                  const tbody = table.tBodies[0];
                  const col = parseInt(this.getAttribute('data-col'));
                  const rows = Array.from(tbody.querySelectorAll('tr'));
                  const isNumeric = col === 3;
                  const currentIndicator = this.querySelector('.sort-indicator');
                  const ascending = !this.classList.contains('sorted-asc');
                  // Remove sort indicators from all headers
                  document.querySelectorAll('.custom-thead th[data-col]').forEach(th2 => {
                    th2.classList.remove('sorted-asc', 'sorted-desc');
                    th2.querySelector('.sort-indicator').textContent = '';
                  });
                  // Add indicator to current
                  this.classList.add(ascending ? 'sorted-asc' : 'sorted-desc');
                  currentIndicator.textContent = ascending ? '▲' : '▼';
                  rows.sort((a, b) => {
                    let aText = a.children[col].textContent.trim();
                    let bText = b.children[col].textContent.trim();
                    if (isNumeric) {
                      aText = parseInt(aText, 10);
                      bText = parseInt(bText, 10);
                    }
                    if (aText < bText) return ascending ? -1 : 1;
                    if (aText > bText) return ascending ? 1 : -1;
                    return 0;
                  });
                  rows.forEach(row => tbody.appendChild(row));
                });
              });

              // Add row with mock data when "+" icon is clicked
              document.getElementById('addRow').addEventListener('click', function() {
                const tbody = document.querySelector('#approval-table tbody');
                const editIcon = '${editIcon}';
                const deleteIcon = '${deleteIcon}';
                const newRow = document.createElement('tr');
                newRow.innerHTML = '<td>mock-repo</td>' +
                  '<td>mock-branch</td>' +
                  '<td>mock-team</td>' +
                  '<td>1</td>' +
                  '<td>' +
                    '<span class="edit-row" style="cursor:pointer;" title="Edit">' + editIcon + '</span>' +
                    '<span class="delete-row ms-2" style="cursor:pointer;" title="Delete">' + deleteIcon + '</span>' +
                  '</td>';
                tbody.appendChild(newRow);
              });
              
              // Remove row when delete icon is clicked
              document.querySelector('#approval-table').addEventListener('click', function(event) {
                if (event.target.closest('.delete-row')) {
                  const row = event.target.closest('tr');
                  if (row) row.remove();
                }
              });

              // save table data to server
              document.getElementById('saveTable').addEventListener('click', function() {
                const rows = document.querySelectorAll('#approval-table tbody tr');
                const repos = [];
                rows.forEach(row => {
                  const cells = row.querySelectorAll('td');
                  repos.push({
                    repo_name: cells[0].textContent.trim(),
                    branch: cells[1].textContent.trim(),
                    team: cells[2].textContent.trim(),
                    required_approvals: parseInt(cells[3].textContent.trim(), 10)
                  });
                });
                fetch('/app/approval-rules', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ repos })
                }).then(async res => {
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    if (data.pr_url) {
                      // Set the link and show the modal
                      document.getElementById('prLink').textContent = data.pr_url;
                      document.getElementById('prLink').href = data.pr_url;
                      const prModal = new bootstrap.Modal(document.getElementById('prModal'));
                      prModal.show();
                    } else {
                      alert(data.message || 'Saved');
                    }
                  } else {
                    alert('Save failed: ' + (data.message || res.statusText));
                  }
                });
              });

              // Inline edit row
              document.querySelector('#approval-table').addEventListener('click', function(event) {
                const editIcon = '${editIcon}';
                const deleteIcon = '${deleteIcon}';
              
                const editBtn = event.target.closest('.edit-row');
                if (!editBtn) return;
              
                const row = editBtn.closest('tr');
                if (!row) return;
              
                // Prevent multiple edits at once
                if (row.classList.contains('editing')) return;
                row.classList.add('editing');
              
                const cells = row.querySelectorAll('td');
                const original = Array.from(cells).map(td => td.innerHTML);
              
                // Only edit the first 4 columns (repo, branch, team, approvals)
                for (let i = 0; i < 4; i++) {
                  const value = cells[i].textContent.trim();
                  cells[i].innerHTML = '<input type="text" class="form-control form-control-sm" value="' + value + '">';
                }
              
                // Replace action cell with Done/Cancel
                cells[4].innerHTML = 
                  '<button class="btn btn-sm btn-success done-edit" title="Done">Done</button>' +
                  '<button class="btn btn-sm btn-secondary cancel-edit ms-2" title="Cancel">Cancel</button>';
              
                // Done handler
                cells[4].querySelector('.done-edit').onclick = function() {
                  for (let i = 0; i < 4; i++) {
                    const input = cells[i].querySelector('input');
                    cells[i].textContent = input.value;
                  }
                  cells[4].innerHTML =
                    '<span class="edit-row" style="cursor:pointer;" title="Edit">' + editIcon + '</span>' +
                    '<span class="delete-row ms-2" style="cursor:pointer;" title="Delete">' + deleteIcon + '</span>';
                  row.classList.remove('editing');
                };
              
                // Cancel handler
                cells[4].querySelector('.cancel-edit').onclick = function() {
                  for (let i = 0; i < 5; i++) {
                    cells[i].innerHTML = original[i];
                  }
                  row.classList.remove('editing');
                };
              });

            </script>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

            <!-- Modal -->
            <div class="modal fade" id="prModal" tabindex="-1" aria-labelledby="prModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content bg-dark text-light">
                  <div class="modal-header">
                    <h5 class="modal-title" id="prModalLabel">Pull Request Created</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                    <a id="prLink" href="#" target="_blank" class="link-info"></a>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
      res.send(html);
    } catch (err) {
      res.status(500).send(`Error loading approval rules: ${err.message}`);
    }
  });
}