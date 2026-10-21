"""
backend/app/services/mongodb_service.py

Secondary Database Integration (MongoDB) as specified in the Architecture Diagram:
- Document DB storage for Challenge Telemetry, Logs, User Preferences, Content, and Notifications.
- Handles graceful fallback to local document file store if MongoDB instance is not reachable.
"""

import os
from datetime import datetime
from typing import Dict, Any, List, Optional
import json
from pathlib import Path


MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "cognitive_alarm_documents")
FALLBACK_LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs" / "mongodb_fallback"


class MongoDBService:
    def __init__(self):
        self.client = None
        self.db = None
        self.is_connected = False
        self._initialize_connection()

    def _initialize_connection(self):
        try:
            import pymongo
            self.client = pymongo.MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=1500,
            )
            # Ping to test connectivity
            self.client.admin.command('ping')
            self.db = self.client[MONGODB_DB_NAME]
            self.is_connected = True
        except Exception:
            self.client = None
            self.db = None
            self.is_connected = False

    def log_document(self, collection_name: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Write document to MongoDB collection, or to fallback JSON store if Mongo is offline.
        """
        doc = dict(document)
        doc["timestamp"] = doc.get("timestamp") or datetime.utcnow().isoformat()

        if self.is_connected and self.db is not None:
            try:
                result = self.db[collection_name].insert_one(doc)
                doc["_id"] = str(result.inserted_id)
                return {"status": "stored_in_mongodb", "collection": collection_name, "id": str(result.inserted_id)}
            except Exception:
                pass

        # Fallback local document persistence
        try:
            FALLBACK_LOG_DIR.mkdir(parents=True, exist_ok=True)
            col_file = FALLBACK_LOG_DIR / f"{collection_name}.jsonl"
            with open(col_file, "a", encoding="utf-8") as f:
                # Clean datetime objects for serialization
                clean_doc = {k: str(v) if isinstance(v, datetime) else v for k, v in doc.items()}
                f.write(json.dumps(clean_doc) + "\n")
            return {"status": "stored_in_fallback_store", "collection": collection_name}
        except Exception as e:
            return {"status": "logging_error", "error": str(e)}

    def get_status(self) -> Dict[str, Any]:
        """
        Return connectivity status for system health reports.
        """
        return {
            "name": "MongoDB (Secondary Document DB)",
            "role": "Challenge Telemetry, User Preferences, Activity Logs, Content",
            "uri": MONGODB_URI.split("@")[-1] if "@" in MONGODB_URI else MONGODB_URI,
            "connected": self.is_connected,
            "status": "connected" if self.is_connected else "fallback_file_store_active",
        }


# Global singleton
mongodb_service = MongoDBService()
