# DELI (“fooD rEcipe environmentaL Impact”) Calculator 😋🍀🧮
[https://deli-calculator.indecol.no](https://deli-calculator.indecol.no) - a web-application for comprehensive, quantitative sustainability assessment of food recipies.

Main developer
* Bo Huang

based on a research work of
* Paula Alejandra Barco Alzate
* Jeongmin Kim

led by
* Francesca Verones
* Konstantin Stadler

## Deployment info 🪲

**Current Deployment (August 2026):** The app is deployed on the OpenStack VM `delicalc`. See Bitwarden for access credentials.  
Source directory: `/apps/deli-calculator`  
VM user (`iedl`) is configured to do git operations on behalf of a GitHub user (`iedlWeb`).

> **Note:** As of August 2026, the server has been migrated from `misc4iedlG` to the new OpenStack VM `delicalc`.

### Deploying changes

#### - in source code

1. `ssh` to the VM
1. `cd /apps/deli-calculator/` go to the source directory
1. `git pull` fetch the changes from github
1. `cd /apps/` go where the compose configs are
1. `docker compose up --build delicalc-host -d` rebuild and redeploy the image, detach from the shell

If necessary - commit/push the source code changes to an upstream (github) repository.

#### - in data

1. ssh to the VM and find the datasets under `/apps/deli-calculator/app/backend/data`
2. make and save changes
3. rebuild and redeploy the image, as described above

### OpenStack Deployment Guidelines 🔧

**Before deploying:**
- Ensure the OpenStack VM instance is running and accessible
- Verify network connectivity and firewall rules allow inbound traffic on port 80/443
- Confirm SSH access is configured with appropriate keys (stored in Bitwarden)

**Common OpenStack-specific tasks:**
- **Check VM status:** Use OpenStack dashboard or CLI to verify instance health
- **Snapshots:** Take VM snapshots before major deployments for quick rollback capability
- **Monitoring:** Log into the OpenStack console to monitor CPU, memory, and disk usage
- **Backups:** Ensure `/apps/deli-calculator/app/backend/data` is backed up regularly

**Troubleshooting:**
- If deployment fails, check Docker daemon status: `docker ps`
- Verify disk space: `df -h` (ensure `/apps` has sufficient space for builds)
- Check logs: `docker logs delicalc-host`
- Restart Docker if needed: `sudo systemctl restart docker`

**Database & Data Management:**
- Critical datasets are stored in `/apps/deli-calculator/app/backend/data/`
- CSV files in `data/` and `FABIO_DELI/` contain impact factors and biodiversity data
- Always commit dataset changes to the repository for version control

### Project structure ⏫

[./misc/](./misc/) - things related to the research project, e.g. publications, (jupyter) noteboks, datasheets, illustrations

[./app/](./app/) - the app: source files, server and deployment configs etc.

### App architecture 🛠️ (tentatively)
![Architecture](./misc/architecture.drawio.png "Architecture")

## Contributors 🥇

Built/developed/maintained by [IEDL](https://github.com/orgs/NTNU-IndEcol/teams/iedl).
