# Stock Inventory System

A lightweight web application for managing hardware shop inventory, featuring AI-powered sticker scanning using Google Gemini.

## Tech Stack
- **Frontend**: Vanilla JS, HTML, CSS (served via Nginx)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **AI Extraction**: Google Gemini API (`gemini-flash-lite-latest`)

## Getting Started

1. **Configure Environment Variables**
   Copy the example environment file and fill in your Gemini API key:
   ```bash
   cp .env.example .env
   ```

2. **Start the Application**
   Use Docker Compose to build and start the containers:
   ```bash
   docker compose up -d --build
   ```

3. **Run Database Migrations**
   Initialize the database tables:
   ```bash
   docker compose exec backend npm run migrate
   ```

4. **Seed an Admin User**
   Create your initial owner account (replace `<username>` and `<password>` with your desired credentials):
   ```bash
   docker compose exec backend npm run seed:users <username> <password> owner
   ```

5. **Access the App**
   Open your browser and navigate to `http://localhost:8082`.
