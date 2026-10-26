import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Successfully connnected to mongoDB 👍`);
  } catch (error) {
    throw new Error("Could not connect to MongoDB. Check MONGO_URI and ensure MongoDB is running.");
    process.exit(1);
  }
};

export default connectDB;
