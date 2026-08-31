# Food Carbon Footprint Calculator

This is a web app to calculate the carbon footprint of food based on user input (ingredients, amount, unit, and import location). The app is built with Python/Flask and deployed using Docker Compose.

## Quick Start

### Local Development

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/NTNU-IndEcol/deli-calculator.git
   cd deli-calculator/app
   ```

2. **Install Dependencies**: 
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the app**: 
   ```bash
   python app.py  
   ``` 
   The app will be available at `http://localhost:5000`

### Docker Deployment

The application is deployed using Docker Compose on the OpenStack VM `delicalc`.

**Key Configuration (docker-compose.yml):**
- **Service**: `delicalc-host`
- **Port**: 9000:9000
- **Domain**: deli-calculator.indecol.no (via Traefik reverse proxy)
- **Data Volume**: `/app/backend/data/` persisted on host

**Required Environment Variables:**
```
TURNSTILE_SITEKEY=<Cloudflare Turnstile site key>
TURNSTILE_SECRET=<Cloudflare Turnstile secret>
GITHUB_TOKEN=<GitHub personal access token>
GITHUB_REPO_OWNER=NTNU-indecol
GITHUB_REPO_NAME=deli-calculator
```

(Credentials stored in Bitwarden)

**Build and Deploy on `delicalc`:**
```bash
ssh iedl@delicalc
cd /apps/
docker compose up --build delicalc-host -d
```

**View Logs:**
```bash
docker logs delicalc-host
```

**Stop the Service:**
```bash
docker compose down
```

## Project Structure

See [STRUCTURE.md](STRUCTURE.md) for details.

## Requirements

- Python 3.x
- Flask
- pandas

## License

This project is licensed under the MIT License.
