const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes'); // Adjust path as needed

const app = express();

// --- MIDDLEWARE (CRITICAL) ---
app.use(cors());
// Parses incoming JSON payloads
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- ROUTES ---
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('XO Rig Backend is running');
});

// Use this for local testing or export app for Vercel/tests
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;