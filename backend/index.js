import {securityHeaders,apiLimit,originGuard,inputGuard,safeError} from './middlewares/security.js';
import printRoutes from './routes/printRoutes.js';
import campusRoutes from './routes/campusRoutes.js';
import {startFulfillment} from './utils/fulfillment.js';
import notificationRoutes from './routes/notificationRoutes.js';
import {startOrderNotifications} from './utils/orderPush.js';
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
if(process.env.NODE_ENV==='production'&&process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must contain at least 32 characters in production.');
const port = process.env.PORT || 5010;

await connectDB();
await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
const recovered=await recoverCheckouts();
if(recovered)console.log(`Recovered ${recovered} interrupted checkouts.`);

const app = express();
app.set('trust proxy','loopback');

app.disable('x-powered-by');
app.use(securityHeaders);
app.use('/api',apiLimit,originGuard);
app.use(express.json({limit:'64kb',strict:true}));
app.use(inputGuard);
app.use(cookieParser());

app.get('/api/health', (req,res) => {
  const ready=mongoose.connection.readyState===1;
  res.status(ready?200:503).json({status:ready?'ok':'unavailable'});
});
app.use("/api/print",printRoutes);
app.use("/api/campus",campusRoutes);
app.use("/api/notifications",notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", orderRoutes);



const __dirname = path.resolve();
app.use('/uploads',(req,res,next)=>{
 if(!/\.(?:jpe?g|png|webp|gif|avif)$/i.test(req.path))return res.status(404).json({message:'Not found'});
 res.set('Content-Security-Policy',"default-src 'none'; sandbox");next();
},express.static(path.join(__dirname,'uploads'),{dotfiles:'deny',index:false}));

app.use(express.static(path.join(__dirname, "frontend/dist")));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return res.status(404).json({message: "Not found"});
  res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
});
app.use(safeError);

startFulfillment();
startOrderNotifications();
const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Server running on port: ${port}`));
server.headersTimeout=10000;server.requestTimeout=60000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=1000;
