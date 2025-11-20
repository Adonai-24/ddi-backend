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
  timestamp: {
    type: Date,
    set: (value) => {
      const num = Number(value);
      if (!isNaN(num)) {
        return new Date(num * 1000); 
      }
      return new Date();
    },
  }
}));

// CONEXIÓN MQTT (TLS)
const mqttOptions = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  rejectUnauthorized: false,
};

console.log("Conectando a MQTT...");

const client = mqtt.connect(process.env.MQTT_URL, mqttOptions);

client.on("connect", () => {
  console.log("Conectado al broker MQTT (TLS)");
  client.subscribe("esp32/telemetria", (err) => {
    if (err) console.error("Error al suscribirse al topic:", err);
  });
});

//  Recibir mensajes
client.on("message", async (topic, message) => {
  console.log("Mensaje recibido:", message.toString());

  try {
    const data = JSON.parse(message.toString());
    await Telemetria.create(data);
    console.log("Guardado en MongoDB");
  } catch (err) {
    console.error("Error procesando mensaje:", err);
  }
});

// Consultar APIS
const app = express();
app.use(cors());

app.get("/api/telemetria", async (_req, res) => {
  const data = await Telemetria.find().sort({ timestamp: -1 });
  res.json(data);
});

app.get("/api/telemetria/latest", async (_req, res) => {
  const data = await Telemetria.findOne().sort({ timestamp: -1 });
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
