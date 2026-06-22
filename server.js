import 'dotenv/config'
import dns from 'node:dns';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import Category from './model/Category.js';
import User from './model/User.js';
const PORT = process.env.PORT || 5000;

dns.setServers(['1.1.1.1', '8.8.8.8']);
const app = express();
const JWT_SECRET = process.env.JWT_SECRET; // Real project mein ise .env mein rakhein

// Middlewares
app.use(cors());
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'], // Dono ports allow karein
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
}));
// --- SECURITY MIDDLEWARE (The "Guard") ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: "No token provided!" });

    // Token structure: "Bearer <token>"
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Unauthorized!" });
        req.user = decoded; // Isme userId aur role aa jayega
        next();
    });
};

// 1. MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

// 2. Blog Model
const BlogSchema = new mongoose.Schema({
    title: String,
    category: String,
    content: String,
    author: { type: String, default: "admin" },
    createdAt: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', BlogSchema);

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Input Email:", email);
        console.log("Input Password:", password);

        const user = await User.findOne({ email: email.trim() });

        if (!user) {
            console.log("User nahi mila!");
            return res.status(401).json({ message: "Invalid email" });
        }

        console.log("User from DB:", user);
        console.log("Password from DB:", user.password);

        if (user.password !== password) {
            console.log("Password match nahi hua!");
            return res.status(401).json({ message: "Invalid password" });
        }

        // Agar sab sahi hai
        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

app.post('/api/users', verifyToken, async (req, res) => {
    // Sirf Admin check
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access Denied: Admins only!" });
    }

    try {
        const { email, password } = req.body;
        // Default role 'editor' set kar rahe hain
        const newUser = new User({ email, password, role: 'editor' });
        await newUser.save();
        res.status(201).json({ message: "User created successfully!" });
    } catch (error) {
        res.status(400).json({ message: "Error creating user", error: error.message });
    }
});

app.get('/api/users/count', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Access Denied" });

    try {
        const count = await User.countDocuments(); // MongoDB ka count function
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: "Error fetching count" });
    }
});

app.get('/api/blogs', async (req, res) => {
    try { const blogs = await Blog.find().sort({ createdAt: -1 }); res.json(blogs); }
    catch (error) { res.status(500).json({ message: error.message }); }
});

// Protected route (Sirf login user create kar sakta hai)
app.post('/api/blogs', verifyToken, async (req, res) => {
    try { const newBlog = new Blog(req.body); await newBlog.save(); res.status(201).json(newBlog); }
    catch (error) { res.status(500).json({ message: error.message }); }
});

// Admin only blog update
app.patch('/api/blogs/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admin can edit blogs' });
    }
    try {
        const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedBlog) return res.status(404).json({ message: 'Blog not found' });
        res.json(updatedBlog);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin only blog delete
app.delete('/api/blogs/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admin can delete blogs' });
    }
    try {
        const deleted = await Blog.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Blog not found' });
        res.json({ message: 'Blog deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 5. Category Routes
app.get('/api/categories', async (req, res) => {
    try { const categories = await Category.find(); res.json(categories); }
    catch (error) { res.status(500).json({ message: error.message }); }
});

// Protected route (Sirf admin/editor)
app.post('/api/categories', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can add categories" });
    }
    try { const newCategory = new Category(req.body); await newCategory.save(); res.status(201).json(newCategory); }
    catch (err) { res.status(400).json({ message: "Category already exists!" }); }
});

// Admin only category update
app.patch('/api/categories/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can edit categories" });
    }
    try {
        const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCategory) return res.status(404).json({ message: "Category not found" });
        res.json(updatedCategory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin only category delete
app.delete('/api/categories/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can delete categories" });
    }
    try {
        const deleted = await Category.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Category not found" });
        res.json({ message: "Category deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// 6. Stats Route
app.get('/api/stats', async (req, res) => {
    try { const stats = await Blog.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]); res.json(stats); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));