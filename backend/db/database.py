# backend/db/database.py

import os
import psycopg2

def get_connection():
    print("DATABASE_URL =", os.getenv("DATABASE_URL"))
    return psycopg2.connect(os.getenv("DATABASE_URL"))