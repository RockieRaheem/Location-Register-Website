import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { allAfricanCountries } from "./data.ts";
import type { Country } from "./types.ts";

const DATA_FILE = path.join(process.cwd(), "countries-store.json");

function loadCountries(): Country[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading countries-store.json, falling back to defaults:", err);
  }
  return [...allAfricanCountries];
}

function saveCountriesToFile(countries: Country[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(countries, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing countries-store.json:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Persistent store for countries
  let countries: Country[] = loadCountries();

  // API Routes
  app.get("/api/countries", (req, res) => {
    res.json(countries);
  });

  app.get("/api/countries/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const country = countries.find((c) => c.id === id);
    if (country) {
      res.json(country);
    } else {
      res.status(404).json({ message: "Country not found" });
    }
  });

  app.post("/api/countries", (req, res) => {
    const newCountry: Country = {
      ...req.body,
      id: countries.length > 0 ? Math.max(...countries.map(c => c.id)) + 1 : 1,
      updatedAt: new Date().toISOString()
    };
    countries.push(newCountry);
    saveCountriesToFile(countries);
    res.status(201).json(newCountry);
  });

  app.put("/api/countries/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = countries.findIndex((c) => c.id === id);
    if (index !== -1) {
      countries[index] = { ...req.body, id, updatedAt: new Date().toISOString() };
      saveCountriesToFile(countries);
      res.json(countries[index]);
    } else {
      res.status(404).json({ message: "Country not found" });
    }
  });

  app.delete("/api/countries/:id", (req, res) => {
    const id = parseInt(req.params.id);
    countries = countries.filter((c) => c.id !== id);
    saveCountriesToFile(countries);
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
