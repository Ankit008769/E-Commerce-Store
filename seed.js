import mongoose from "mongoose";

// ── DB connect ──────────────────────────────────────────────
await mongoose.connect("mongodb://127.0.0.1:27017/huxnStore");
console.log("✅ Connected to MongoDB");

// ── Schemas ─────────────────────────────────────────────────
const categorySchema = new mongoose.Schema({ name: String });
const Category = mongoose.model("Category", categorySchema);

const productSchema = new mongoose.Schema(
  {
    name: String,
    image: String,
    brand: String,
    quantity: Number,
    category: mongoose.Schema.Types.ObjectId,
    description: String,
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    price: Number,
    countInStock: Number,
    reviews: { type: Array, default: [] },
  },
  { timestamps: true }
);
const Product = mongoose.model("Product", productSchema);

// ── Clear old data ───────────────────────────────────────────
await Category.deleteMany({});
await Product.deleteMany({});
console.log("🗑️  Cleared old categories & products");

// ── Seed categories ──────────────────────────────────────────
const categories = await Category.insertMany([
  { name: "Electronics" },
  { name: "Clothing" },
  { name: "Footwear" },
  { name: "Books" },
  { name: "Home & Kitchen" },
]);

const [electronics, clothing, footwear, books, home] = categories;
console.log("📦 Categories created");

// ── Seed products ────────────────────────────────────────────
await Product.insertMany([
  // Electronics
  {
    name: "iPhone 15 Pro",
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500",
    brand: "Apple",
    quantity: 1,
    category: electronics._id,
    description: "The latest iPhone with A17 Pro chip, titanium design, and a 48MP camera system.",
    price: 999,
    countInStock: 25,
    rating: 4.8,
    numReviews: 120,
  },
  {
    name: "Samsung Galaxy S24",
    image: "https://images.unsplash.com/photo-1706721983499-7b4b2c1a14e5?w=500",
    brand: "Samsung",
    quantity: 1,
    category: electronics._id,
    description: "Flagship Android phone with Snapdragon 8 Gen 3 and 200MP camera.",
    price: 849,
    countInStock: 30,
    rating: 4.6,
    numReviews: 98,
  },
  {
    name: "Sony WH-1000XM5 Headphones",
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=500",
    brand: "Sony",
    quantity: 1,
    category: electronics._id,
    description: "Industry-leading noise cancelling wireless headphones with 30hr battery.",
    price: 349,
    countInStock: 50,
    rating: 4.9,
    numReviews: 210,
  },
  {
    name: "MacBook Pro 14\"",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500",
    brand: "Apple",
    quantity: 1,
    category: electronics._id,
    description: "M3 Pro chip, 18GB RAM, stunning Liquid Retina XDR display.",
    price: 1999,
    countInStock: 15,
    rating: 4.9,
    numReviews: 87,
  },

  // Clothing
  {
    name: "Classic White T-Shirt",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
    brand: "H&M",
    quantity: 1,
    category: clothing._id,
    description: "Premium 100% cotton classic fit white t-shirt, perfect for everyday wear.",
    price: 19,
    countInStock: 100,
    rating: 4.3,
    numReviews: 55,
  },
  {
    name: "Slim Fit Denim Jeans",
    image: "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=500",
    brand: "Levi's",
    quantity: 1,
    category: clothing._id,
    description: "Classic slim fit jeans in dark wash denim, comfortable all-day wear.",
    price: 59,
    countInStock: 80,
    rating: 4.5,
    numReviews: 73,
  },

  // Footwear
  {
    name: "Nike Air Max 270",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
    brand: "Nike",
    quantity: 1,
    category: footwear._id,
    description: "Lightweight running shoes with Max Air unit for all-day comfort.",
    price: 129,
    countInStock: 60,
    rating: 4.7,
    numReviews: 145,
  },
  {
    name: "Adidas Ultraboost 23",
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500",
    brand: "Adidas",
    quantity: 1,
    category: footwear._id,
    description: "Premium running shoes with Boost midsole for energy return.",
    price: 179,
    countInStock: 45,
    rating: 4.6,
    numReviews: 112,
  },

  // Books
  {
    name: "The Pragmatic Programmer",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500",
    brand: "Addison-Wesley",
    quantity: 1,
    category: books._id,
    description: "A classic guide for software developers on writing clean, maintainable code.",
    price: 39,
    countInStock: 200,
    rating: 4.8,
    numReviews: 320,
  },
  {
    name: "Clean Code",
    image: "https://images.unsplash.com/photo-1589998059171-988d887df646?w=500",
    brand: "Prentice Hall",
    quantity: 1,
    category: books._id,
    description: "Robert C. Martin's guide to writing readable and maintainable code.",
    price: 34,
    countInStock: 150,
    rating: 4.7,
    numReviews: 280,
  },

  // Home & Kitchen
  {
    name: "Instant Pot Duo 7-in-1",
    image: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=500",
    brand: "Instant Pot",
    quantity: 1,
    category: home._id,
    description: "7-in-1 multi-use pressure cooker, slow cooker, rice cooker and more.",
    price: 89,
    countInStock: 40,
    rating: 4.8,
    numReviews: 430,
  },
  {
    name: "Dyson V15 Vacuum",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500",
    brand: "Dyson",
    quantity: 1,
    category: home._id,
    description: "Powerful cordless vacuum with laser dust detection and HEPA filtration.",
    price: 749,
    countInStock: 20,
    rating: 4.9,
    numReviews: 195,
  },
]);

console.log("🛍️  12 Products created");
console.log("✅ Seeding complete!");
await mongoose.disconnect();
