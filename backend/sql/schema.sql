PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS Delivery;
DROP TABLE IF EXISTS FuelRequest;
DROP TABLE IF EXISTS Station;
DROP TABLE IF EXISTS Storage;

CREATE TABLE Station (
  Id INTEGER PRIMARY KEY,
  Name TEXT NOT NULL,
  Latitude REAL NOT NULL,
  Longitude REAL NOT NULL
);

CREATE TABLE Storage (
  Id INTEGER PRIMARY KEY,
  Name TEXT NOT NULL,
  Latitude REAL NOT NULL,
  Longitude REAL NOT NULL,
  FuelAvailable INTEGER NOT NULL CHECK (FuelAvailable >= 0)
);

CREATE TABLE FuelRequest (
  Id INTEGER PRIMARY KEY,
  StationId INTEGER NOT NULL,
  FuelAmount INTEGER NOT NULL CHECK (FuelAmount > 0),
  Priority TEXT NOT NULL CHECK (Priority IN ('low', 'medium', 'high', 'critical')),
  Status TEXT NOT NULL CHECK (Status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
  CreatedAt TEXT NOT NULL,
  FOREIGN KEY (StationId) REFERENCES Station(Id)
);

CREATE TABLE Delivery (
  Id INTEGER PRIMARY KEY,
  RequestId INTEGER NOT NULL,
  WarehouseId INTEGER NOT NULL,
  DeliveredAmount INTEGER NOT NULL CHECK (DeliveredAmount >= 0),
  Status TEXT NOT NULL CHECK (Status IN ('queued', 'en_route', 'delivered', 'failed')),
  CreatedAt TEXT NOT NULL,
  FOREIGN KEY (RequestId) REFERENCES FuelRequest(Id),
  FOREIGN KEY (WarehouseId) REFERENCES Storage(Id)
);

CREATE INDEX idx_fuel_request_station_id ON FuelRequest(StationId);
CREATE INDEX idx_fuel_request_status ON FuelRequest(Status);
CREATE INDEX idx_delivery_request_id ON Delivery(RequestId);
CREATE INDEX idx_delivery_warehouse_id ON Delivery(WarehouseId);
