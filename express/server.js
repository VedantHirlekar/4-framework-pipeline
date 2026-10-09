const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

const PORT = 3000;

app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// GET /health
app.get("/health", (req, res) => {
    res.json({
        status: "UP",
        service: "express"
    });
    console.log("Express health check requested");

});

// GET /employees - Get all employees
app.get("/employees", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name, email FROM employees"
        );

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to retrieve employees"
        });
    }
});

// POST /employees - Add an employee
app.post("/employees", async (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({
            error: "Name and email are required"
        });
    }

    try {
        // Check whether email already exists
        const [rows] = await pool.execute(
            "SELECT id FROM employees WHERE email = ?",
            [email]
        );

        if (rows.length > 0) {
            return res.status(409).json({
                error: "Email already exists"
            });
        }

        // Insert employee
        const [result] = await pool.execute(
            "INSERT INTO employees (name, email) VALUES (?, ?)",
            [name, email]
        );

        res.status(201).json({
            message: "Employee added successfully",
            id: result.insertId,
            name: name,
            email: email
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to add employee"
        });
    }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on port ${PORT}`);
});