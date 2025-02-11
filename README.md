# DELI (“fooD rEcipe environmentaL Impact”) Calculator 😋🍀🧮
[https://deli-calculator.indecol.no](https://deli-calculator.indecol.no) - a web-application for comprehensive, quantitative sustainability assessment of food recipies.

Based on a research work of
* Paula Alejandra Barco Alzate
* Jeongmin Kim

led by
* Francesca Verones
* Konstantin Stadler

## Development info 🪲

### Project structure ⏫

[./misc/](./misc/) - things related to the research project, e.g. publications, (jupyter) noteboks, datasheets, illustrations

[./app/](./app/) - the app: source files, server and deployment configs etc.

### App architecture 🛠️
\- tba

### Database schema 🗃️
\- tba

## Deployment info 🐙

VM's IP: `10.212.26.57`, runs on `stack.it.ntnu.no` (`IV-EPT_Misc-Indecol` -> `sandbox4deli`)

Flavour: `gx3.2c3r`

Eph. vol: `delicalc-vol` (56 GiB) mounted as `/dev/vdb` on `./app/backend/data` mountpoint.

#### Access the VM:
`ssh` (credentials @ BitWarden -> `sandbox4deli`)

### Deploying changes

#### - in source code
VM user is cofigured to do git operations on behalf of `iedlWeb` github user. Hence:
  1. `ssh` to the VM
  2. `cd deli-calculator/app`
  3. `docker compose down -v` (shut down the docker compose service)
  4. `git pull` (fetch the changes from github)
  5. `docker compose up --build -d ` (rebuild image(s) and start the service)
If necessary - commit/push the changes to an upstream (github) repository.

#### - in data
  1. either ssh to the VM and find the datasets under `./app/backend/data` or use samba `smb://10.212.26.57/<share-name>` (credentials @ Bitwarden too)
  2. make and save changes
  3. `ssh` to the VM and `cd` to the `app` directory, as described above, then `docker compose restart`

### TLS cert renewal
Stored under `/etc/letsencrypt/live/deli-calculator.indecol.no/`. Renew before May 5th, 2025.

## Contributors 🥇

Built/developed/maintained by [IEDL](https://github.com/orgs/NTNU-IndEcol/teams/iedl).
