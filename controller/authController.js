const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

// Login function
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Use the secret key from the environment variable
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Send success message along with the token
        res.status(200).json({
            message: "User logged in successfully",
            token: token
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Signup function
const signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const user = new User({ username, email, password });
        await user.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = { signup, login };
