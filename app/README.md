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

## Ingredient mass conversion

Environmental impact factors are multiplied by ingredient mass in tonnes. DELI resolves recipe quantities in the following order:

1. Direct mass units (`g`, `kg`, `ounce`, and `lb`) use fixed unit identities.
2. Volume and count units use an exact ingredient-and-unit factor from `backend/data/Conversion_factors.csv` when available.
3. Unsupported volume units (`ml`, `dl`, `l`, `tsp`, `tbsp`, and `cup`) use a water-equivalent density of 1 kg/L and are flagged as fallbacks.
4. Unsupported count units are rejected instead of receiving a universal assumed mass.

Calculation exports include converted mass, conversion route, factor, source, and fallback status. Ingredient-specific factors and their sources require validation before a research release; a water-equivalent fallback is not an ingredient-specific density estimate.

`Conversion_factors.csv` is stored as UTF-8 because browser `fetch().text()` decodes response bodies as UTF-8. Keep this encoding when editing the table so ingredient keys remain reproducible.

From the repository root, run the focused JavaScript regression tests with Node.js:

```bash
node --test tests/unit-converter.test.mjs
```

## License

This project is licensed under the MIT License.
