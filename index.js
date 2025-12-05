/*****************************************************************************
 * @Author                : adolnb<loro.lorenzonunez@gmail.com>              *
 * @CreatedDate           : 2025-11-18 17:49:50                              *
 * @LastEditors           : adolnb<loro.lorenzonunez@gmail.com>              *
 * @LastEditDate          : 2025-11-19 19:08:30                              *
 * @FilePath              : index.js                                         *
 * @CopyRight             : © 2025 Adonai LN - B0MB0                         *
 ****************************************************************************/

import mqtt from "mqtt";
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import moment from "moment-timezone";
import { config } from "dotenv";

config();

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error(err));

const Telemetria = mongoose.model("Telemetria", new mongoose.Schema({
  temperatura: Number,
  humedad: Number,
  wifi_rssi: Number,
  uptime: Number,
  timestamp: Number,
  interval: Number,
  local: Date,
}));

// CONEXIÓN MQTT (TLS)
const mqttOptions = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  rejectUnauthorized: false,
};

const client = mqtt.connect(process.env.MQTT_URL, mqttOptions);

client.on("connect", () => {
  client.subscribe("esp32/telemetria", (err) => {
    if (err) console.error("Error al suscribirse al topic:", err);
  });
});

//  Recibir mensajes
client.on("message", async (topic, message) => {
  console.log("Mensaje recibido:", message.toString());

  try {
    const data = JSON.parse(message.toString());
    const fechaLocal = moment().tz("America/Mexico_City").subtract(6, "hours").toDate();

    data.local = fechaLocal;

    await Telemetria.create(data);
    console.log("Guardado en MongoDB");
  } catch (err) {
    console.error("Error procesando mensaje:", err);
  }
});

// Consultar APIS
const app = express();
app.use(cors());
app.use(express.json());


app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const users = [
    { email: process.env.USER1_EMAIL, pass: process.env.USER1_PASS },
    { email: process.env.USER2_EMAIL, pass: process.env.USER2_PASS }
  ];

  const user = users.find(u => u.email === email && u.pass === password);

  if (!user) {
    return res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    { email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ success: true, token, email: user.email });
});


app.get("/api/update", (_req, res) => {
  const randomSeconds = Math.floor(Math.random() * (60 - 4 + 1)) + 4;

  res.json({ success: true, interval: randomSeconds, });
});


app.get("/api/telemetria", async (_req, res) => {
  const data = await Telemetria.find({
    interval: { $exists: true },
    local: { $exists: true }
  }).sort({ local: -1 });
  res.json(data);
});

app.get("/api/telemetria/latest", async (_req, res) => {
  const data = await Telemetria.findOne().sort({ local: -1 });
  res.json(data);
});

app.get("/api/telemetria/count", async (_req, res) => {
  try {
    const total = await Telemetria.countDocuments();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo el conteo" });
  }
});

app.listen(process.env.PORT, () => console.log("API corriendo en puerto", process.env.PORT));
