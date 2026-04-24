/**
 * Entry Point
 * Initializes environment variables, connects to the database, and starts the server.
 */
require("dotenv").config();
const app = require("./src/app");
const connectToDB = require("./src/config/db");

const PORT = process.env.PORT || 3000;

// Establish database connection
connectToDB()

// Start listening for requests
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
});