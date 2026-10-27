import {recoverCheckouts} from './utils/checkoutRecovery.js';
// packages
import path from "path";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// Utiles
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();
if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace-with-a-long-random-secret') {
  throw new Error('Configure MONGO_URI and a private JWT_SECRET in .env before starting CampusCart.');
}
const port = process.env.PORT || 5010;

await connectDB();
const recovered=await recoverCheckouts();
if(recovered)console.log(`Recovered ${recovered} interrupted checkouts.`);

const app = express();
app.set('trust proxy','loopback');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req,res) => {
  const ready=mongoose.connection.readyState===1;
  res.status(ready?200:503).json({status:ready?'ok':'unavailable'});
});
app.use("/api/users", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", orderRoutes);



const __dirname = path.resolve();
app.use("/uploads", express.static(path.join(__dirname + "/uploads")));

app.use(express.static(path.join(__dirname, "frontend/dist")));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return res.status(404).json({message: "Not found"});
  res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
});
app.use((error, req, res, next) => res.status(error.status || 500).json({message: error.message}));

app.listen(port, () => console.log(`Server running on port: ${port}`));
