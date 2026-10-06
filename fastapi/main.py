import os

from fastapi import FastAPI
import mysql.connector

app = FastAPI()


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )


@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "fastapi"
    }


@app.get("/employees")
def get_employees():

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id, name FROM employees")

        employees = cursor.fetchall()

        return employees

    finally:
        cursor.close()
        connection.close()