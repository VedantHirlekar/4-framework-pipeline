const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

const PORT = 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

app.get("/health", (req, res) => {
    res.json({
        status: "UP",
        service: "express"
    });
});


app.get("/employees", async (req, res) => {

    try {

        const [rows] = await pool.query(
            "SELECT id, name FROM employees"
        );

        res.json(rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Database connection failed"
        });
    }
});


app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on port ${PORT}`);
});
