from __future__ import annotations

import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = PROJECT_ROOT / "backend" / "sql" / "schema.sql"
DATA_DIR = PROJECT_ROOT / "data"
DATABASE_PATH = DATA_DIR / "fuel-management-dev.sqlite"

STATION_NAMES = [
    "Downtown Station",
    "Airport Station",
    "Suburban Station",
    "Highway Station",
    "River Point Station",
    "North Gate Station",
    "South Park Station",
    "West End Station",
]

STORAGE_NAMES = [
    "Central Warehouse",
    "North Depot",
    "East Storage",
    "South Terminal",
]

REQUEST_PRIORITIES = ["low", "medium", "high", "critical"]
REQUEST_STATUSES = ["pending", "approved", "in_progress", "completed"]
DELIVERY_STATUSES = ["queued", "en_route", "delivered", "failed"]


def random_float(min_value: float, max_value: float, digits: int = 6) -> float:
    return round(random.uniform(min_value, max_value), digits)


def random_date_within_last_days(days_back: int) -> str:
    now = datetime.now(timezone.utc)
    delta = timedelta(
        days=random.randint(0, days_back),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59),
    )
    return (now - delta).isoformat()


def build_stations() -> list[tuple[int, str, float, float]]:
    return [
        (
            index + 1,
            name,
            random_float(49.80, 50.65),
            random_float(30.10, 31.25),
        )
        for index, name in enumerate(STATION_NAMES)
    ]


def build_storages() -> list[tuple[int, str, float, float, int]]:
    return [
        (
            index + 1,
            name,
            random_float(49.80, 50.65),
            random_float(30.10, 31.25),
            random.randint(15000, 90000),
        )
        for index, name in enumerate(STORAGE_NAMES)
    ]


def build_fuel_requests(
    stations: list[tuple[int, str, float, float]],
    total: int,
) -> list[tuple[int, int, int, str, str, str]]:
    station_ids = [station[0] for station in stations]
    requests: list[tuple[int, int, int, str, str, str]] = []

    for request_id in range(1, total + 1):
        requests.append(
            (
                request_id,
                random.choice(station_ids),
                random.randint(800, 12000),
                random.choice(REQUEST_PRIORITIES),
                random.choice(REQUEST_STATUSES),
                random_date_within_last_days(14),
            )
        )

    return requests


def build_deliveries(
    requests: list[tuple[int, int, int, str, str, str]],
    storages: list[tuple[int, str, float, float, int]],
) -> list[tuple[int, int, int, int, str, str]]:
    storage_ids = [storage[0] for storage in storages]
    deliveries: list[tuple[int, int, int, int, str, str]] = []
    delivery_id = 1

    for request in requests:
        request_id, _, fuel_amount, _, request_status, _ = request

        if random.random() < 0.25:
            continue

        if request_status == "completed":
            delivered_amount = fuel_amount
            delivery_status = "delivered"
        elif request_status == "in_progress":
            delivered_amount = random.randint(max(200, int(fuel_amount * 0.4)), fuel_amount)
            delivery_status = random.choice(["queued", "en_route"])
        else:
            delivered_amount = random.randint(max(200, int(fuel_amount * 0.4)), fuel_amount)
            delivery_status = random.choice(DELIVERY_STATUSES)

        deliveries.append(
            (
                delivery_id,
                request_id,
                random.choice(storage_ids),
                delivered_amount,
                delivery_status,
                random_date_within_last_days(10),
            )
        )
        delivery_id += 1

    return deliveries


def recreate_database() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.execute("PRAGMA foreign_keys = ON;")
    connection.execute("PRAGMA journal_mode = MEMORY;")
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return connection


def seed_database(connection: sqlite3.Connection) -> dict[str, int]:
    stations = build_stations()
    storages = build_storages()
    fuel_requests = build_fuel_requests(stations, total=24)
    deliveries = build_deliveries(fuel_requests, storages)

    connection.executemany(
        "INSERT INTO Station (Id, Name, Latitude, Longitude) VALUES (?, ?, ?, ?)",
        stations,
    )
    connection.executemany(
        "INSERT INTO Storage (Id, Name, Latitude, Longitude, FuelAvailable) VALUES (?, ?, ?, ?, ?)",
        storages,
    )
    connection.executemany(
        "INSERT INTO FuelRequest (Id, StationId, FuelAmount, Priority, Status, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        fuel_requests,
    )
    connection.executemany(
        "INSERT INTO Delivery (Id, RequestId, WarehouseId, DeliveredAmount, Status, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        deliveries,
    )
    connection.commit()

    tables = ["Station", "Storage", "FuelRequest", "Delivery"]
    summary: dict[str, int] = {}

    for table_name in tables:
        row = connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()
        summary[table_name] = int(row[0]) if row else 0

    return summary


def main() -> None:
    connection = recreate_database()
    try:
        summary = seed_database(connection)
    finally:
        connection.close()

    print(f"SQLite database created at {DATABASE_PATH}")
    for table_name, count in summary.items():
        print(f"{table_name}: {count}")


if __name__ == "__main__":
    main()
