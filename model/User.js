import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Note: Real project mein password hash karte hain
    role: { type: String, enum: ['admin', 'editor'], default: 'editor' }
});

export default mongoose.model('User', userSchema, 'Users');