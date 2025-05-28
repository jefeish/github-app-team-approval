# Team Approval App

A Probot-based GitHub App that enforces team-based approval rules for pull requests, configurable via a YAML file in an admin repository. The app supports multiple teams, wildcard branch patterns, and provides a web admin UI for the approval rules.

---

## Features

- Enforce required approvals from specific teams per repo/branch
- Supports wildcard branch patterns (e.g., `release/*`)
- Centralized YAML configuration in an admin repo
- Web admin UI for managing approval rules
- Probot-based, easy to deploy

---

## Overview

```mermaid
graph LR
    Repo[Repository] --> PR[Pull Request]
    
    subgraph "Approval Process"
        PR --> A["Review Required<br>(Branch Protection Rule)"]
        A --> B{Approvals}
        
        subgraph "Required Approvers (App)"
            TeamB[TEAM-B<br>xxx-Approver] -->|Min 2 approvals| B
            TeamA[TEAM-A<br>xxx-Developer] -->|Min 1 approval| B
        end
        
        B -->|Total: 3 approvals met| C[Approval Complete]
    end
    
    C --> Merge[Merge to Protected Branch]
    
    style PR fill: #f9f,stroke:#333,stroke-width:2px
    style TeamA fill: #FF9933,stroke:#333,stroke-width:1px
    style TeamB color: #fff, fill:#d55,stroke:#333,stroke-width:1px
    style B fill:#ff9,stroke:#333,stroke-width:2px
    style Merge fill:#9f9,stroke:#333,stroke-width:2px
    
```

---

## How It Works

1. **Pull request review events** trigger the app.
2. The app loads approval rules from a YAML file in a central admin repository.
3. It matches the PR’s repo and branch (supports wildcards) to all relevant rules.
4. For each rule, it checks if the required number of approvals from the specified team is met.
5. The app can set PR status or leave comments based on the result.
6. Admins can manage rules via a web UI.

---

## Configuration

Approval rules are managed in a YAML file (example):

```yaml
repos:
  - repo_name: jefeish-1
    branch: main
    team: team-x
    required_approvals: 2
  - repo_name: repo-two
    branch: release/*
    team: release-team
    required_approvals: 3
```

---

## Admin UI Screenshot

![Admin UI Screenshot](docs/images/admin-screen-edit.png)

*Above: The web admin page for managing repository approval rules.*

---

## Scenarios

| #  | Repo-Exact-Match | Repo-Wildcard-Match | Branch-Exact-Match | Branch-Wildcard-Match | Matching Rule? | Notes                                                                                   |
|----|:---------------:|:-------------------:|:------------------:|:--------------------:|:--------------:|-----------------------------------------------------------------------------------------|
| 1  | ✅              | ❌                  | ✅                 | ❌                   | yes            | Exact repo and branch match                                                             |
| 2  | ✅              | ❌                  | ❌                 | ✅                   | yes            | Exact repo, branch matches wildcard (e.g. hotfix/*)                                     |
| 3  | ✅              | ❌                  | ❌                 | ❌                   | no             | Exact repo, branch does not match any rule                                              |
| 4  | ❌              | ✅                  | ✅                 | ❌                   | yes            | Repo matches wildcard (`*`), branch exact                                               |
| 5  | ❌              | ✅                  | ❌                 | ✅                   | yes            | Repo matches wildcard (hotfix/*), branch matches wildcard                               |
| 6  | ❌              | ✅                  | ❌                 | ❌                   | no             | Repo matches wildcard, branch does not match any rule                                   |
| 7  | ❌              | ❌                  | ✅                 | ❌                   | no            | No repo match, but branch matches a wildcard rule (`*`)                                 |
| 8  | ❌              | ❌                  | ❌                 | ✅                   | no            | No repo match, branch matches wildcard rule (`*`)                                       |
| 9  | ❌              | ❌                  | ❌                 | ❌                   | no             | No repo or branch match                                                                 |
| 10 | *              | *                   | *                  | *                    | yes            | If rule uses `*` for repo and/or branch, it matches everything                          |

**Legend:**  
- ✅ = True (match for that column)  
- ❌ = False  
- * = "Don't care" (wildcard rule, matches everything)

**Matching Rule?**  
- ✅ if any rule matches (including `*` wildcard for repo or branch)
- ❌ if no rule matches

**Notes:**  
- If a rule uses `*` for repo or branch, it matches all repos or branches respectively.
- If no matching rule is found, the app marks the check as success and comments that no rules apply.

---

## Running Locally

1. Clone the repo and install dependencies:
   ```sh
   npm install
   ```
>**Note:** If the App is already installed, you can proceed to add the custom environment variables, otherwise follow the Probot App instructions on http://localhost:3000/probot first, before you create a `.env` file or add any variables.

2. Set environment variables in `.env`:
   ```
   ADMIN_REPO_ORG=your-org
   ADMIN_REPO_NAME=your-admin-repo
   ADMIN_REPO_PATH=approval_rules.yaml
   ```

3. Start the app:
   ```sh
   npm start
   ```

   or

   ```sh
   npm run dev
   ```

5. Access the admin UI at `http://localhost:3000/app/approval-rules`

---

## License

[ISC](LICENSE) © 2025 Jürgen Efeish
